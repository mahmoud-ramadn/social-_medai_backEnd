import jwt from "jsonwebtoken";
import { ENV } from "../lib/env";

export const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, ENV.JWT_SECRET || "", { expiresIn: "7d" });
};

export const verifyToken = (token: string): { id: string } => {
  return jwt.verify(token, ENV.JWT_SECRET || "") as { id: string };
};
