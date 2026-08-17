// src/routes/auth.routes.ts
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, logout } from "../controllers/auth.controller";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { message: "Too many login attempts, please try again later" },
});

router.post("/register", register);
router.post("/login", login); 
router.post("/logout", logout);

export default router;
