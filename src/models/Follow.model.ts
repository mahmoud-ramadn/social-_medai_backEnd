import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";

export interface IFollow extends Document {
  follower: IUser["_id"];
  followed: IUser["_id"];
  createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followed: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Ensure a user cannot follow the same person twice
FollowSchema.index({ follower: 1, followed: 1 }, { unique: true });

export default mongoose.model<IFollow>("Follow", FollowSchema);
