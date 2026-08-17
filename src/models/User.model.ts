import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    displayName: { type: String, default: "" },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model<IUser>("User", userSchema);
