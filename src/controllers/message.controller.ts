import { Response } from "express";
import Message from "../models/Message.model";
import User from "../models/User.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadToCloudinary } from "../config/cloudinary";
import fs from "fs";

export const getConversations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const userId = req.user.id;

    // Find all messages involving current user, sorted by latest first
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username displayName avatar bio")
      .populate("receiver", "username displayName avatar bio");

    const conversationMap = new Map<string, any>();

    for (const msg of messages) {
      const sender = msg.sender as any;
      const receiver = msg.receiver as any;
      const otherUser = sender._id.toString() === userId ? receiver : sender;
      const otherUserId = otherUser._id.toString();

      if (!conversationMap.has(otherUserId)) {
        // Media-only messages have no text, so give the list a readable preview
        const lastMessage = msg.content?.trim()
          ? msg.content
          : msg.mediaType === "video"
            ? "🎥 Video"
            : msg.mediaType === "image"
              ? "📷 Photo"
              : "";

        conversationMap.set(otherUserId, {
          id: otherUserId,
          user: {
            id: otherUser._id,
            username: otherUser.username,
            displayName: otherUser.displayName || otherUser.username,
            avatar: otherUser.avatar || "",
            bio: otherUser.bio || "",
          },
          lastMessage,
          timestamp: msg.createdAt.toISOString(),
          unread: 0,
        });
      }

      // Count unread if current user is the receiver and message is unread
      if (receiver._id.toString() === userId && !msg.read) {
        const conv = conversationMap.get(otherUserId);
        conv.unread += 1;
      }
    }

    res.json(Array.from(conversationMap.values()));
  } catch (error) {
    console.error("getConversations error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessages = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;

    // Mark messages from other user to me as read
    await Message.updateMany(
      { sender: otherUserId, receiver: currentUserId, read: false },
      { $set: { read: true } },
    );

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId },
        { sender: otherUserId, receiver: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "username displayName avatar bio");

    const formattedMessages = messages.map((msg) => {
      const sender = msg.sender as any;
      return {
        id: msg._id,
        sender: {
          id: sender._id,
          username: sender.username,
          displayName: sender.displayName || sender.username,
          avatar: sender.avatar || "",
          bio: sender.bio || "",
        },
        content: msg.content,
        // NOTE: these two fields were missing before, so media disappeared
        // as soon as you reloaded the page or re-opened the conversation.
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
        timestamp: msg.createdAt.toISOString(),
        isOwn: sender._id.toString() === currentUserId,
      };
    });

    res.json(formattedMessages);
  } catch (error) {
    console.error("getMessages error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const sendMessage = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { userId: receiverId } = req.params;
    const { content } = req.body;

    if ((!content || !content.trim()) && !req.file) {
      res.status(400).json({ message: "Message content or media is required" });
      return;
    }

    // Check the receiver exists BEFORE uploading anything to Cloudinary, so a
    // bad receiverId can't waste an upload (this used to happen after upload).
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // already gone or inaccessible — nothing more we can do
        }
      }
      res.status(404).json({ message: "Receiver not found" });
      return;
    }

    let mediaUrl: string | undefined;
    let mediaType: "image" | "video" | undefined;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(
        req.file.path,
        "social_media/messages",
      );
      mediaUrl = uploadResult.url;
      mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // temp file cleanup best-effort only
      }
    }

    const message = new Message({
      sender: req.user.id,
      receiver: receiverId,
      // default to "" instead of undefined so media-only messages don't trip
      // a `required` validator on `content` in the Message schema
      content: content?.trim() || "",
      mediaUrl,
      mediaType,
    });

    await message.save();

    const populatedMessage = await message.populate(
      "sender",
      "username displayName avatar bio",
    );
    const sender = populatedMessage.sender as any;

    const messagePayload = {
      id: populatedMessage._id,
      sender: {
        id: sender._id,
        username: sender.username,
        displayName: sender.displayName || sender.username,
        avatar: sender.avatar || "",
        bio: sender.bio || "",
      },
      content: populatedMessage.content,
      mediaUrl: populatedMessage.mediaUrl,
      mediaType: populatedMessage.mediaType,
      timestamp: populatedMessage.createdAt.toISOString(),
      isOwn: false,
    };

    // Emit real-time message via socket.io
    const io = req.app.get("io");
    if (io) {
      io.to(String(receiverId)).emit("new_message", messagePayload);
    }

    // Return the response for the sender
    res.status(201).json({
      ...messagePayload,
      isOwn: true,
    });
  } catch (error) {
    console.error("sendMessage error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
