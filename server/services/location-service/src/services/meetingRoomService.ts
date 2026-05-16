import mongoose from "mongoose";
import {
  AppError,
  DB_NAMES,
  getConnection,
  getLocationModel,
  getMeetingRoomModel,
  type LocationDoc,
  type MeetingRoomDoc,
} from "@syt/shared";

async function roomModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getMeetingRoomModel(conn);
}

async function locModel() {
  const conn = await getConnection(DB_NAMES.locations);
  return getLocationModel(conn);
}

export type MeetingRoomPublic = {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  floor: string;
  capacity: number;
  isActive: boolean;
};

function toPublicRoom(doc: MeetingRoomDoc, locationName: string): MeetingRoomPublic {
  return {
    id: doc._id.toString(),
    locationId: doc.locationId.toString(),
    locationName,
    name: doc.name,
    floor: doc.floor ?? "",
    capacity: doc.capacity,
    isActive: doc.isActive,
  };
}

export async function listRooms(): Promise<MeetingRoomPublic[]> {
  const MeetingRoom = await roomModel();
  const Location = await locModel();
  const docs = await MeetingRoom.find({}).sort({ locationId: 1, name: 1 }).lean();
  const locIds = [...new Set(docs.map((d) => d.locationId.toString()))];
  const locs = await Location.find({ _id: { $in: locIds } })
    .select("name")
    .lean();
  const nameBy = new Map(locs.map((l) => [l._id.toString(), (l as unknown as LocationDoc).name]));
  return docs.map((d) =>
    toPublicRoom(d as unknown as MeetingRoomDoc, nameBy.get(d.locationId.toString()) ?? "")
  );
}

export async function createRoom(input: {
  locationId: string;
  name: string;
  floor: string;
  capacity: number;
}) {
  const MeetingRoom = await roomModel();
  const Location = await locModel();
  const loc = await Location.findById(input.locationId);
  if (!loc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
  const doc = await MeetingRoom.create({
    locationId: input.locationId,
    name: input.name.trim(),
    floor: input.floor.trim(),
    capacity: input.capacity,
    isActive: true,
  });
  const locName = (loc as unknown as LocationDoc).name ?? "";
  return toPublicRoom(doc as unknown as MeetingRoomDoc, locName);
}

export async function updateRoom(
  roomId: string,
  input: Partial<{ name: string; floor: string; capacity: number; locationId: string; isActive: boolean }>
) {
  const MeetingRoom = await roomModel();
  const Location = await locModel();
  const doc = await MeetingRoom.findById(roomId);
  if (!doc) throw new AppError(404, "חדר לא נמצא", "NOT_FOUND");
  if (input.locationId !== undefined) {
    const loc = await Location.findById(input.locationId);
    if (!loc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
    doc.locationId = new mongoose.Types.ObjectId(input.locationId);
  }
  if (input.name !== undefined) doc.name = input.name.trim();
  if (input.floor !== undefined) doc.floor = input.floor.trim();
  if (input.capacity !== undefined) doc.capacity = input.capacity;
  if (input.isActive !== undefined) doc.isActive = input.isActive;
  await doc.save();
  const locDoc = await Location.findById(doc.locationId).lean();
  const locName = locDoc ? (locDoc as unknown as LocationDoc).name : "";
  return toPublicRoom(doc as unknown as MeetingRoomDoc, locName);
}

/** Soft-delete: inactive rooms cannot receive new bookings */
export async function softDeleteRoom(roomId: string) {
  return updateRoom(roomId, { isActive: false });
}
