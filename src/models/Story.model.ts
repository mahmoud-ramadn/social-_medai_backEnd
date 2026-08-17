import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";

export interface IStory extends Document {
  author: IUser["_id"];
  mediaUrl: string;
  mediaType: "image" | "video";
  cloudinaryId: string;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    cloudinaryId: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// TTL Index: Automatically delete story documents 24 hours (86400 seconds) after creation
StorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model<IStory>("Story", StorySchema);
