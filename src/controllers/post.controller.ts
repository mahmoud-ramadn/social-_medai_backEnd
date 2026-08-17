import { Response } from "express";
import Post from "../models/Post.model";
import Comment from "../models/Comment.model";
import Follow from "../models/Follow.model";
import User from "../models/User.model";
import Notification from "../models/Notification.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import fs from "fs";
import mongoose from "mongoose";

export const createPost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { content } = req.body;
    if (!content && !req.file) {
      res.status(400).json({ message: "Post content or media is required" });
      return;
    }

    let imageUrl = "";
    let mediaType: "image" | "video" | "" = "";
    let cloudinaryId = "";

    if (req.file) {
      try {
        const isVideo = req.file.mimetype.startsWith("video/");
        mediaType = isVideo ? "video" : "image";

        const uploadResult = await uploadToCloudinary(req.file.path, "posts");
        imageUrl = uploadResult.url;
        cloudinaryId = uploadResult.publicId;

        // Clean up temp file
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        res.status(500).json({ message: "Failed to upload post media" });
        return;
      }
    }

    const newPost = new Post({
      author: req.user.id,
      content: content || "",
      image: imageUrl,
      mediaType,
      cloudinaryId,
    });

    await newPost.save();

    const populatedPost = await newPost.populate(
      "author",
      "username displayName avatar bio",
    );

    // --- NOTIFICATIONS ---
    const io = req.app.get("io");
    const followersDocs = await Follow.find({ followed: req.user.id });
    if (followersDocs.length > 0) {
      const notifications = followersDocs.map((doc) => ({
        recipient: doc.follower,
        sender: req.user!.id,
        type: "new_post",
        post: newPost._id,
      }));
      await Notification.insertMany(notifications);

      followersDocs.forEach((doc) => {
        const followerId = String(doc.follower);
        io.to(followerId).emit("newNotification");
        io.to(followerId).emit("newFeedPost");
      });
    }

    io.emit("newExplorePost", { authorId: String(req.user.id) });
    // ---------------------

    res.status(201).json({
      id: populatedPost._id,
      author: {
        id: (populatedPost.author as any)._id,
        username: (populatedPost.author as any).username,
        displayName:
          (populatedPost.author as any).displayName ||
          (populatedPost.author as any).username,
        avatar: (populatedPost.author as any).avatar || "",
        bio: (populatedPost.author as any).bio || "",
      },
      content: populatedPost.content,
      image: populatedPost.image || "",
      mediaType: populatedPost.mediaType || "",
      likes: 0,
      comments: 0,
      shares: 0,
      timestamp: populatedPost.createdAt.toISOString(),
      isLiked: false,
    });
  } catch (error) {
    console.error("createPost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getFeed = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const followingDocs = await Follow.find({ follower: req.user.id }).select(
      "followed",
    );
    const followedIds = followingDocs.map((f) => f.followed);

    const query = {
      author: { $in: [...followedIds, req.user.id] },
    };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .populate("author", "username displayName avatar bio");

    const formattedPosts = posts.map((post) => {
      const author = post.author as any;
      return {
        id: post._id,
        author: {
          id: author._id,
          username: author.username,
          displayName: author.displayName || author.username,
          avatar: author.avatar || "",
          bio: author.bio || "",
        },
        content: post.content,
        image: post.image || "",
        mediaType: post.mediaType || "",
        likes: post.likes.length,
        comments: post.comments.length,
        shares: 0,
        timestamp: post.createdAt.toISOString(),
        isLiked: post.likes.some((id) => id.toString() === req.user?.id),
      };
    });

    res.json(formattedPosts);
  } catch (error) {
    console.error("getFeed error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPostById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "author",
      "username displayName avatar bio",
    );

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const author = post.author as any;
    res.json({
      id: post._id,
      author: {
        id: author._id,
        username: author.username,
        displayName: author.displayName || author.username,
        avatar: author.avatar || "",
        bio: author.bio || "",
      },
      content: post.content,
      image: post.image || "",
      mediaType: post.mediaType || "",
      likes: post.likes.length,
      comments: post.comments.length,
      shares: 0,
      timestamp: post.createdAt.toISOString(),
      isLiked: req.user?.id
        ? post.likes.some((id) => id.toString() === req.user?.id)
        : false,
    });
  } catch (error) {
    console.error("getPostById error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.author.toString() !== req.user.id) {
      res
        .status(403)
        .json({ message: "Forbidden: You cannot delete someone else's post" });
      return;
    }

    if (post.cloudinaryId) {
      await deleteFromCloudinary(post.cloudinaryId);
    }

    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(post._id);

    res.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("deletePost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserPosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { userId } = req.params;
    const posts = await Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate("author", "username displayName avatar bio");

    const formattedPosts = posts.map((post) => {
      const author = post.author as any;
      return {
        id: post._id,
        author: {
          id: author._id,
          username: author.username,
          displayName: author.displayName || author.username,
          avatar: author.avatar || "",
          bio: author.bio || "",
        },
        content: post.content,
        image: post.image || "",
        mediaType: post.mediaType || "",
        likes: post.likes.length,
        comments: post.comments.length,
        shares: 0,
        timestamp: post.createdAt.toISOString(),
        isLiked: req.user?.id
          ? post.likes.some((id) => id.toString() === req.user?.id)
          : false,
      };
    });

    res.json(formattedPosts);
  } catch (error) {
    console.error("getUserPosts error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const toggleLikePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user.id) as any;
    const isLiked = post.likes.some((id) => id.toString() === req.user?.id);

    if (isLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.user?.id);
    } else {
      post.likes.push(userObjectId);

      if (post.author.toString() !== req.user.id) {
        const notif = new Notification({
          recipient: post.author,
          sender: req.user.id,
          type: "like",
          post: post._id,
        });
        await notif.save();

        const io = req.app.get("io");
        io.to(String(post.author)).emit("newNotification");
      }
    }

    await post.save();

    res.json({
      likes: post.likes.length,
      isLiked: !isLiked,
    });
  } catch (error) {
    console.error("toggleLikePost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const addComment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { content } = req.body;
    if (!content) {
      res.status(400).json({ message: "Comment content is required" });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    const newComment = new Comment({
      author: req.user.id,
      post: post._id,
      content,
    });

    await newComment.save();

    post.comments.push(newComment._id as any);
    await post.save();

    if (post.author.toString() !== req.user.id) {
      const notif = new Notification({
        recipient: post.author,
        sender: req.user.id,
        type: "comment",
        post: post._id,
      });
      await notif.save();

      const io = req.app.get("io");
      io.to(post.author.toString()).emit("newNotification");
    }

    const populatedComment = await newComment.populate(
      "author",
      "username displayName avatar bio",
    );

    const author = populatedComment.author as any;
    res.status(201).json({
      id: populatedComment._id,
      author: {
        id: author._id,
        username: author.username,
        displayName: author.displayName || author.username,
        avatar: author.avatar || "",
        bio: author.bio || "",
      },
      content: populatedComment.content,
      timestamp: populatedComment.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("addComment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPostComments = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .populate("author", "username displayName avatar bio");

    const formattedComments = comments.map((comment) => {
      const author = comment.author as any;
      return {
        id: comment._id,
        author: {
          id: author._id,
          username: author.username,
          displayName: author.displayName || author.username,
          avatar: author.avatar || "",
          bio: author.bio || "",
        },
        content: comment.content,
        timestamp: comment.createdAt.toISOString(),
      };
    });

    res.json(formattedComments);
  } catch (error) {
    console.error("getPostComments error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const editComment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { content } = req.body;
    if (!content) {
      res.status(400).json({ message: "Comment content is required" });
      return;
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    if (comment.author.toString() !== req.user.id) {
      res
        .status(403)
        .json({ message: "Forbidden: You cannot edit someone else's comment" });
      return;
    }

    comment.content = content;
    await comment.save();

    res.json({ message: "Comment updated", content: comment.content });
  } catch (error) {
    console.error("editComment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteComment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Check if current user is the comment author OR the post author
    const isCommentAuthor = comment.author.toString() === req.user.id;
    const post = await Post.findById(comment.post);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }
    const isPostAuthor = post.author.toString() === req.user.id;

    if (!isCommentAuthor && !isPostAuthor) {
      res
        .status(403)
        .json({ message: "Forbidden: You cannot delete this comment" });
      return;
    }

    await Comment.findByIdAndDelete(req.params.commentId);

    post.comments = post.comments.filter(
      (id) => id.toString() !== req.params.commentId,
    );
    await post.save();

    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("deleteComment error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getExplorePosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "username displayName avatar bio");

    const formattedPosts = posts.map((post) => {
      const author = post.author as any;
      return {
        id: post._id,
        author: {
          id: author._id,
          username: author.username,
          displayName: author.displayName || author.username,
          avatar: author.avatar || "",
          bio: author.bio || "",
        },
        content: post.content,
        image: post.image || "",
        mediaType: post.mediaType || "",
        likes: post.likes.length,
        comments: post.comments.length,
        shares: 0,
        timestamp: post.createdAt.toISOString(),
        isLiked: req.user?.id
          ? post.likes.some((id) => id.toString() === req.user?.id)
          : false,
      };
    });

    res.json(formattedPosts);
  } catch (error) {
    console.error("getExplorePosts error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---- NEW: Update Post (edit content & media) ----
export const updatePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    if (post.author.toString() !== req.user.id) {
      res
        .status(403)
        .json({ message: "Forbidden: You cannot update someone else's post" });
      return;
    }

    const { content } = req.body;

    if (content !== undefined) {
      post.content = content.trim() || "";
    }

    if (req.file) {
      // Delete old media if exists
      if (post.cloudinaryId) {
        await deleteFromCloudinary(post.cloudinaryId);
      }

      const isVideo = req.file.mimetype.startsWith("video/");
      const uploadResult = await uploadToCloudinary(req.file.path, "posts");
      post.image = uploadResult.url;
      post.cloudinaryId = uploadResult.publicId;
      post.mediaType = isVideo ? "video" : "image";

      // Clean up temp file
      fs.unlinkSync(req.file.path);
    }

    await post.save();

    const updatedPost = await post.populate(
      "author",
      "username displayName avatar bio",
    );
    const author = updatedPost.author as any;

    res.json({
      id: updatedPost._id,
      author: {
        id: author._id,
        username: author.username,
        displayName: author.displayName || author.username,
        avatar: author.avatar || "",
        bio: author.bio || "",
      },
      content: updatedPost.content,
      image: updatedPost.image || "",
      mediaType: updatedPost.mediaType || "",
      likes: updatedPost.likes.length,
      comments: updatedPost.comments.length,
      shares: 0,
      timestamp: updatedPost.createdAt.toISOString(),
      isLiked: updatedPost.likes.some((id) => id.toString() === req.user?.id),
    });
  } catch (error) {
    console.error("updatePost error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
