import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";

export interface PasswordResetTokenDoc {
  _id: import("mongoose").Types.ObjectId;
  tokenHash: string;
  userId: import("mongoose").Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<PasswordResetTokenDoc>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getPasswordResetTokenModel(conn: Connection): Model<PasswordResetTokenDoc> {
  return (
    conn.models.PasswordResetToken ??
    conn.model<PasswordResetTokenDoc>("PasswordResetToken", passwordResetTokenSchema)
  );
}
