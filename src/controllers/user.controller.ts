import { Response } from "express";
import User from "../models/User.model";
import Follow from "../models/Follow.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadToCloudinary } from "../config/cloudinary";
import fs from "fs";

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    
    // Get followers/following count
    const followersCount = await Follow.countDocuments({ followed: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName || user.username,
      avatar: user.avatar || "",
      bio: user.bio || "",
      followers: followersCount,
      following: followingCount,
    });
  } catch (error) {
    console.error("getMe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("-password");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const followersCount = await Follow.countDocuments({ followed: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    let isFollowing = false;
    if (req.user?.id) {
      const followRelation = await Follow.findOne({
        follower: req.user.id,
        followed: user._id,
      });
      isFollowing = !!followRelation;
    }

    res.json({
      id: user._id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar || "",
      bio: user.bio || "",
      followers: followersCount,
      following: followingCount,
      isFollowing,
    });
  } catch (error) {
    console.error("getUserProfile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { displayName, bio } = req.body;
    const updateData: any = {};

    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.path, "avatars");
        updateData.avatar = uploadResult.url;
        // Delete local temp file
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error("Avatar upload to Cloudinary failed:", uploadError);
        res.status(500).json({ message: "Failed to upload avatar" });
        return;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const followersCount = await Follow.countDocuments({ followed: updatedUser._id });
    const followingCount = await Follow.countDocuments({ follower: updatedUser._id });

    res.json({
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      displayName: updatedUser.displayName || updatedUser.username,
      avatar: updatedUser.avatar || "",
      bio: updatedUser.bio || "",
      followers: followersCount,
      following: followingCount,
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const searchUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      res.json([]);
      return;
    }

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: "i" } },
        { displayName: { $regex: q, $options: "i" } },
      ],
    })
      .select("username displayName avatar bio")
      .limit(10);

    const formattedUsers = await Promise.all(
      users.map(async (u) => {
        const followersCount = await Follow.countDocuments({ followed: u._id });
        const followingCount = await Follow.countDocuments({ follower: u._id });
        let isFollowing = false;
        if (req.user?.id) {
          const followRelation = await Follow.findOne({
            follower: req.user.id,
            followed: u._id,
          });
          isFollowing = !!followRelation;
        }

        return {
          id: u._id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatar: u.avatar || "",
          bio: u.bio || "",
          followers: followersCount,
          following: followingCount,
          isFollowing,
        };
      })
    );

    res.json(formattedUsers);
  } catch (error) {
    console.error("searchUsers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSuggestedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Get list of followed users
    const followingDocs = await Follow.find({ follower: req.user.id }).select("followed");
    const followedIds = followingDocs.map((f) => f.followed);

    // Exclude self and followed users
    const suggested = await User.find({
      _id: { $ne: req.user.id, $nin: followedIds },
    })
      .limit(5)
      .select("username displayName avatar bio");

    const formattedSuggested = await Promise.all(
      suggested.map(async (u) => {
        const followersCount = await Follow.countDocuments({ followed: u._id });
        const followingCount = await Follow.countDocuments({ follower: u._id });
        return {
          id: u._id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatar: u.avatar || "",
          bio: u.bio || "",
          followers: followersCount,
          following: followingCount,
          isFollowing: false,
        };
      })
    );

    res.json(formattedSuggested);
  } catch (error) {
    console.error("getSuggestedUsers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
