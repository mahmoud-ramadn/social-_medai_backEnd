import { Router } from "express";
import {
  getConversations,
  getMessages,
  sendMessage,
} from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.get("/conversations", authMiddleware, getConversations);
router.get("/:userId", authMiddleware, getMessages);
router.post("/:userId", authMiddleware, upload.single("media"), sendMessage);

export default router;
