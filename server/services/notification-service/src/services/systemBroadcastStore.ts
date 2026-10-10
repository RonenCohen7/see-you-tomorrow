import mongoose from "mongoose";
import { DB_NAMES, getConnection, getSystemBroadcastModel, type SystemBroadcastSeverity } from "@syt/shared";

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

async function model() {
  const conn = await getConnection(DB_NAMES.notifications);
  return getSystemBroadcastModel(conn);
}

export type PublicSystemBroadcast = {
  id: string;
  title: string;
  message: string;
  severity: SystemBroadcastSeverity;
  at: string;
};

export async function saveSystemBroadcast(input: {
  title: string;
  message: string;
  severity: SystemBroadcastSeverity;
  createdBy?: string;
}): Promise<PublicSystemBroadcast> {
  const Broadcast = await model();
  const doc = await Broadcast.create({
    title: input.title,
    message: input.message,
    severity: input.severity,
    createdBy: input.createdBy && mongoose.isValidObjectId(input.createdBy) ? input.createdBy : undefined,
    dismissedBy: [],
    createdAt: new Date(),
  });
  return {
    id: doc._id.toString(),
    title: doc.title,
    message: doc.message,
    severity: doc.severity,
    at: doc.createdAt.toISOString(),
  };
}

export async function listPendingSystemBroadcasts(userId: string): Promise<PublicSystemBroadcast[]> {
  if (!mongoose.isValidObjectId(userId)) return [];
  const Broadcast = await model();
  const since = new Date(Date.now() - KEEP_MS);
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const docs = await Broadcast.find({
    createdAt: { $gte: since },
    dismissedBy: { $ne: userObjectId },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    title: doc.title,
    message: doc.message,
    severity: doc.severity,
    at: doc.createdAt.toISOString(),
  }));
}

export async function dismissSystemBroadcast(id: string, userId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) return false;
  const Broadcast = await model();
  const result = await Broadcast.updateOne(
    { _id: id },
    { $addToSet: { dismissedBy: new mongoose.Types.ObjectId(userId) } }
  );
  return result.matchedCount > 0;
}
