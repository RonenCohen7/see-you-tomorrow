import {
  AppError,
  DB_NAMES,
  getConnection,
  getDepartmentModel,
} from "@syt/shared";
import type { DepartmentDoc } from "@syt/shared";

export function toPublic(doc: DepartmentDoc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    imageUrl: doc.imageUrl || undefined,
    locationId: doc.locationId?.toString(),
    managerId: doc.managerId?.toString(),
    isActive: doc.isActive,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function model() {
  const conn = await getConnection(DB_NAMES.departments);
  return getDepartmentModel(conn);
}

export async function createDepartment(input: {
  name: string;
  description?: string;
  imageUrl?: string;
  locationId?: string;
  managerId?: string;
  isActive?: boolean;
}) {
  const Department = await model();
  const doc = await Department.create({
    name: input.name,
    description: input.description,
    imageUrl: input.imageUrl || undefined,
    locationId: input.locationId,
    managerId: input.managerId,
    isActive: input.isActive ?? true,
  });
  return toPublic(doc);
}

export async function updateDepartment(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    imageUrl: string;
    locationId: string;
    managerId: string;
    isActive: boolean;
  }>
) {
  const Department = await model();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};

  if (input.name !== undefined) $set.name = input.name;
  if (input.description !== undefined) $set.description = input.description;
  if (input.locationId !== undefined) $set.locationId = input.locationId;
  if (input.managerId !== undefined) $set.managerId = input.managerId;
  if (input.isActive !== undefined) $set.isActive = input.isActive;
  if (input.imageUrl !== undefined) {
    if (input.imageUrl === "") $unset.imageUrl = 1;
    else $set.imageUrl = input.imageUrl;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  if (!Object.keys(update).length) {
    const doc = await Department.findById(id);
    if (!doc) throw new AppError(404, "מחלקה לא נמצאה", "NOT_FOUND");
    return toPublic(doc);
  }

  const doc = await Department.findByIdAndUpdate(id, update, { new: true });
  if (!doc) throw new AppError(404, "מחלקה לא נמצאה", "NOT_FOUND");
  return toPublic(doc);
}

export async function deleteDepartment(id: string) {
  const Department = await model();
  const doc = await Department.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doc) throw new AppError(404, "מחלקה לא נמצאה", "NOT_FOUND");
  return toPublic(doc);
}

export async function getById(id: string) {
  const Department = await model();
  const doc = await Department.findById(id);
  if (!doc) throw new AppError(404, "מחלקה לא נמצאה", "NOT_FOUND");
  return toPublic(doc);
}

export async function listDepartments(filter: { locationId?: string; isActive?: boolean }) {
  const Department = await model();
  const q: Record<string, unknown> = {};
  if (filter.locationId) q.locationId = filter.locationId;
  if (filter.isActive !== undefined) q.isActive = filter.isActive;
  const docs = await Department.find(q).sort({ name: 1 }).lean();
  return docs.map((d) => toPublic(d as unknown as DepartmentDoc));
}
