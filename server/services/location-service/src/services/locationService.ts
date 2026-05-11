import { AppError, DB_NAMES, getConnection, getLocationModel } from "@syt/shared";
import type { LocationDoc } from "@syt/shared";

export function toPublic(doc: LocationDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    city: doc.city,
    country: doc.country,
    address: doc.address,
    capacity: doc.capacity,
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function model() {
  const conn = await getConnection(DB_NAMES.locations);
  return getLocationModel(conn);
}

export async function createLocation(input: {
  name: string;
  city?: string;
  country?: string;
  address?: string;
  capacity: number;
  isActive?: boolean;
}) {
  const Location = await model();
  const doc = await Location.create({
    ...input,
    isActive: input.isActive ?? true,
  });
  return toPublic(doc);
}

export async function updateLocation(
  id: string,
  input: Partial<{
    name: string;
    city: string;
    country: string;
    address: string;
    capacity: number;
    isActive: boolean;
  }>
) {
  const Location = await model();
  const doc = await Location.findByIdAndUpdate(id, input, { new: true });
  if (!doc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

export async function deleteLocation(id: string) {
  const Location = await model();
  const doc = await Location.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

export async function getById(id: string) {
  const Location = await model();
  const doc = await Location.findById(id);
  if (!doc) throw new AppError(404, "מיקום לא נמצא", "NOT_FOUND");
  return toPublic(doc);
}

export async function listLocations(filter: { isActive?: boolean }) {
  const Location = await model();
  const q: Record<string, unknown> = {};
  if (filter.isActive !== undefined) q.isActive = filter.isActive;
  const docs = await Location.find(q).sort({ name: 1 }).lean();
  return docs.map((d) => toPublic(d as unknown as LocationDoc));
}
