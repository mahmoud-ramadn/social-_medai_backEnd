import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";

export interface IPost extends Document {
  author: IUser["_id"];
  content: string;
  image?: string;
  mediaType: "image" | "video" | "";
  cloudinaryId?: string;
  likes: mongoose.Types.ObjectId[];
  comments: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    image: { type: String, default: "" },
    mediaType: { type: String, enum: ["image", "video", ""], default: "" },
    cloudinaryId: { type: String, default: "" },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IPost>("Post", PostSchema);
