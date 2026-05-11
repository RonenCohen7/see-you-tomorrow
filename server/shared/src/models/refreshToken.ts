import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface RefreshTokenDoc {
  _id: import("mongoose").Types.ObjectId;
  tokenHash: string;
  userId: import("mongoose").Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export function getRefreshTokenModel(conn: Connection): Model<RefreshTokenDoc> {
  return conn.models.RefreshToken ?? conn.model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
}
