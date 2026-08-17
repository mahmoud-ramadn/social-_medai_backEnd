import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";
import { IPost } from "./Post.model";

export interface IComment extends Document {
  author: IUser["_id"];
  post: IPost["_id"];
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    content: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IComment>("Comment", CommentSchema);
