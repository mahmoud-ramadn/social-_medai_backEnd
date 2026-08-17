import { Request, Response } from "express";
import User from "../models/User.model";
import { hashPassword, comparePassword } from "../Utilities/bcrypt.utils"; 
import { generateToken } from "../Utilities/jwt.utils";
import { setAuthCookie, clearAuthCookie } from "../Utilities/cookie.utils";

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validateRegisterInput = (
  username: string,
  email: string,
  password: string,
): string | null => {
  if (!username || username.trim().length < 3)
    return "Username must be at least 3 characters";
  if (!email || !isValidEmail(email)) return "Invalid email address";
  if (!password || password.length < 8)
    return "Password must be at least 8 characters";
  return null; // valid
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    let { username, email, password } = req.body;

    email = email?.trim().toLowerCase();

    const validationError = validateRegisterInput(username, email, password);
    if (validationError) {
      res.status(400).json({ message: validationError });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = generateToken(user._id.toString());

    setAuthCookie(res, token);

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || "",
        bio: user.bio || "",
      },
    });
  } catch (error: any) {
    // Handle duplicate key (race condition)
    if (error.code === 11000) {
      // duplicate key error (username or email)
      const field = Object.keys(error.keyPattern)[0];
      res.status(400).json({ message: `${field} already taken` });
      return;
    }
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = generateToken(user._id.toString());
    setAuthCookie(res, token);

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || "",
        bio: user.bio || "",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};



export const logout = (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.status(200).json({ message: "Logged out successfully" });
};
