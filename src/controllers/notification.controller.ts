import { Response } from "express";
import Notification from "../models/Notification.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .populate("sender", "username displayName avatar")
      .populate("post", "content image mediaType");

    const formattedNotifications = notifications.map(notif => {
      const sender = notif.sender as any;
      const post = notif.post as any;

      return {
        id: notif._id,
        type: notif.type,
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString(),
        sender: {
          id: sender._id,
          username: sender.username,
          displayName: sender.displayName || sender.username,
          avatar: sender.avatar || "",
        },
        post: post ? {
          id: post._id,
          content: post.content,
          image: post.image,
          mediaType: post.mediaType,
        } : undefined
      };
    });

    res.json(formattedNotifications);
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("markAsRead error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
