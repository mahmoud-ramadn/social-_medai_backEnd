import { Response } from "express";
import Story from "../models/Story.model";
import Follow from "../models/Follow.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadToCloudinary } from "../config/cloudinary";
import fs from "fs";

export const createStory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "Story media is required" });
      return;
    }

    let mediaUrl = "";
    let mediaType: "image" | "video" = "image";
    let cloudinaryId = "";

    try {
      const isVideo = req.file.mimetype.startsWith("video/");
      mediaType = isVideo ? "video" : "image";
      
      const uploadResult = await uploadToCloudinary(req.file.path, "stories");
      mediaUrl = uploadResult.url;
      cloudinaryId = uploadResult.publicId;

      fs.unlinkSync(req.file.path);
    } catch (uploadError) {
      console.error("Cloudinary upload failed for story:", uploadError);
      res.status(500).json({ message: "Failed to upload story media" });
      return;
    }

    const newStory = new Story({
      author: req.user.id,
      mediaUrl,
      mediaType,
      cloudinaryId,
    });

    await newStory.save();
    const populatedStory = await newStory.populate("author", "username displayName avatar");

    res.status(201).json(populatedStory);
  } catch (error) {
    console.error("createStory error:", error);
    res.status(500).json({ message: "Server error creating story" });
  }
};

export const getStoryFeed = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Get users followed by current user
    const followingDocs = await Follow.find({ follower: req.user.id }).select("followed");
    const followedIds = followingDocs.map((f) => f.followed);

    // Get stories from self + followed users
    // (TTL index automatically cleans up older than 24h, but we also filter just in case)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stories = await Story.find({
      author: { $in: [...followedIds, req.user.id] },
      createdAt: { $gt: twentyFourHoursAgo }
    })
      .sort({ createdAt: 1 })
      .populate("author", "username displayName avatar");

    res.json(stories);
  } catch (error) {
    console.error("getStoryFeed error:", error);
    res.status(500).json({ message: "Server error fetching stories" });
  }
};
