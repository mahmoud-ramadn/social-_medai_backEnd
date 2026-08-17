import { Router } from "express";
import { createStory, getStoryFeed } from "../controllers/story.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", authMiddleware, upload.single("media"), createStory);
router.get("/feed", authMiddleware, getStoryFeed);

export default router;
