import { Response } from "express";
import Follow from "../models/Follow.model";
import User, { IUser } from "../models/User.model";
import Notification from "../models/Notification.model";
import { AuthRequest } from "../middleware/auth.middleware";

export const followUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { userId } = req.params;

    if (req.user.id === userId) {
      res.status(400).json({ message: "You cannot follow yourself" });
      return;
    }

    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: req.user.id,
      followed: userId,
    });

    if (existingFollow) {
      res.status(400).json({ message: "Already following this user" });
      return;
    }

    const follow = new Follow({
      follower: req.user.id,
      followed: userId,
    });

    await follow.save();

    // --- NOTIFICATIONS ---
    const notif = new Notification({
      recipient: userId,
      sender: req.user.id,
      type: "follow",
    });
    await notif.save();

    const io = req.app.get("io");
    io.to(String(userId)).emit("newNotification");
    // ---------------------

    res.json({ message: "Successfully followed user", isFollowing: true });
  } catch (error) {
    console.error("followUser error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const unfollowUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { userId } = req.params;

    const followRelation = await Follow.findOneAndDelete({
      follower: req.user.id,
      followed: userId,
    });

    if (!followRelation) {
      res.status(400).json({ message: "You are not following this user" });
      return;
    }

    res.json({ message: "Successfully unfollowed user", isFollowing: false });
  } catch (error) {
    console.error("unfollowUser error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getFollowers = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 0;

    let query = Follow.find({ followed: userId }).populate(
      "follower",
      "username displayName avatar bio",
    );

    if (limit > 0) {
      query = query.limit(limit);
    }

    const followerDocs = await query;

    const followers = await Promise.all(
      followerDocs.map(async (doc) => {
        // After populate(), follower is a User document
        const u = doc.follower as unknown as IUser;

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
          displayName: u.displayName || u.username || "",
          avatar: u.avatar || "",
          bio: u.bio || "",
          isFollowing,
        };
      }),
    );

    res.json(followers);
  } catch (error) {
    console.error("getFollowers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getFollowing = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;

    const followingDocs = await Follow.find({ follower: userId }).populate(
      "followed",
      "username displayName avatar bio",
    );

    const following = await Promise.all(
      followingDocs.map(async (doc) => {
        const u = doc.followed as any;
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
          isFollowing,
        };
      }),
    );

    res.json(following);
  } catch (error) {
    console.error("getFollowing error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getFollowStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.json({ isFollowing: false });
      return;
    }

    const { userId } = req.params;
    const followRelation = await Follow.findOne({
      follower: req.user.id,
      followed: userId,
    });

    res.json({ isFollowing: !!followRelation });
  } catch (error) {
    console.error("getFollowStatus error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
