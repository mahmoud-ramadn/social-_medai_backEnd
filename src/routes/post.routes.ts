import { Router } from "express";
import {
  createPost,
  getFeed,
  getPostById,
  deletePost,
  getUserPosts,
  toggleLikePost,
  addComment,
  getPostComments,
  editComment,
  deleteComment,
  updatePost,

  getExplorePosts,
} from "../controllers/post.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", authMiddleware, upload.single("media"), createPost);
router.get("/feed", authMiddleware, getFeed);
router.get("/explore", authMiddleware, getExplorePosts);
router.get("/user/:userId", authMiddleware, getUserPosts);
router.get("/:id", authMiddleware, getPostById);
router.delete("/:id", authMiddleware, deletePost);
router.post("/:id/like", authMiddleware, toggleLikePost);
router.post("/:id/comment", authMiddleware, addComment);
router.get("/:id/comments", authMiddleware, getPostComments);
router.put("/:id/comment/:commentId", authMiddleware, editComment);
router.delete("/:id/comment/:commentId", authMiddleware, deleteComment);
router.put("/:id", authMiddleware, upload.single("media"), updatePost);
export default router;
