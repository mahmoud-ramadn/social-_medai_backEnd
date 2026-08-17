import express from "express";
import { getNotifications, markAsRead } from "../controllers/notification.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/", authMiddleware, getNotifications);
router.put("/mark-read", authMiddleware, markAsRead);

export default router;
