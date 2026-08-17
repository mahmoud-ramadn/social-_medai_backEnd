import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import connectDB from "./config/database";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import postRoutes from "./routes/post.routes";
import followRoutes from "./routes/follow.routes";
import messageRoutes from "./routes/message.routes";
import notificationRoutes from "./routes/notification.routes";
import storyRoutes from "./routes/story.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { ENV } from "./lib/env";
import cookieParser from "cookie-parser";

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new SocketServer(server, {
  cors: {
    origin: ENV.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Attach io to app to access in controllers
app.set("io", io);

app.use(cookieParser());

// Helmet config (allowing styles/images from CDN/Google fonts)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stories", storyRoutes);

app.use(errorMiddleware);

// Socket events
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (userId: string) => {
    if (!userId) return;
    const roomId = String(userId);
    socket.join(roomId);
    console.log(`User ${roomId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start server
const PORT = ENV.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
