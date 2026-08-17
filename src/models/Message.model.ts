import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";

export interface IMessage extends Document {
  sender: IUser["_id"];
  receiver: IUser["_id"];
  content?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  read: boolean;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: false },
    mediaUrl: { type: String, required: false },
    mediaType: { type: String, enum: ["image", "video"], required: false },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model<IMessage>("Message", MessageSchema);
