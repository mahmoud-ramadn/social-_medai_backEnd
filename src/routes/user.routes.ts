import { Router } from "express";
import { getMe, getUserProfile, updateProfile, searchUsers, getSuggestedUsers } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.get("/suggested", authMiddleware, getSuggestedUsers);
router.get("/search", authMiddleware, searchUsers);
router.get("/:username", authMiddleware, getUserProfile);
router.put("/me", authMiddleware, upload.single("avatar"), updateProfile);

export default router;
