import mongoose, { Schema, Document } from "mongoose";
import { IUser } from "./User.model";

export interface IBlock extends Document {
  blocker: IUser["_id"];
  blocked: IUser["_id"];
  createdAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    blocker: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blocked: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export default mongoose.model<IBlock>("Block", BlockSchema);
