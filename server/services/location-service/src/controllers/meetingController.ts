import type { Response } from "express";
import { AppError, requireAdmin, requireAuth, type AuthRequest } from "@syt/shared";
import { z } from "zod";
import type { MeetingMaterialDoc } from "@syt/shared";
import * as bookingSvc from "../services/meetingBookingService.js";
import * as roomSvc from "../services/meetingRoomService.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const materialSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    url: z.string().min(1).max(2000),
    label: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal("file"),
    fileName: z.string().min(1).max(400),
    mimeType: z.string().max(120).optional(),
    dataUrl: z.string().min(1).max(bookingSvc.MEETING_DATA_URL_MAX_CHARS),
  }),
]);

function ensurePartialHours(body: {
  hourStart?: number;
  hourEnd?: number;
}) {
  if (
    body.hourStart != null &&
    body.hourEnd != null &&
    body.hourStart !== undefined &&
    body.hourEnd !== undefined &&
    body.hourStart >= body.hourEnd
  ) {
    throw new AppError(400, "שעת הסיום חייבת להיות אחרי שעת ההתחלה", "VALIDATION");
  }
}

const createRoomSchema = z.object({
  locationId: objectId,
  name: z.string().min(1).max(120),
  floor: z.string().max(80).default(""),
  capacity: z.number().int().min(1).max(500),
});

const patchRoomSchema = z.object({
  locationId: objectId.optional(),
  name: z.string().min(1).max(120).optional(),
  floor: z.string().max(80).optional(),
  capacity: z.number().int().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});

const createBookingSchema = z.object({
  roomId: objectId,
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hourStart: z.number().min(0).max(24).optional(),
  hourEnd: z.number().min(0).max(24).optional(),
  title: z.string().min(1).max(500),
  inviteeIds: z.array(objectId).max(499).default([]),
  materials: z.array(materialSchema).max(bookingSvc.MEETING_MATERIAL_MAX_ITEMS).default([]),
});

const patchBookingSchema = z.object({
  roomId: objectId.optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hourStart: z.number().min(0).max(24).nullable().optional(),
  hourEnd: z.number().min(0).max(24).nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  inviteeIds: z.array(objectId).max(499).optional(),
  materials: z.array(materialSchema).max(bookingSvc.MEETING_MATERIAL_MAX_ITEMS).optional(),
});

function assertBooker(req: AuthRequest) {
  if (!req.user) throw new AppError(401, "נדרשת התחברות", "UNAUTHORIZED");
  const r = req.user.role;
  if (r !== "employee" && r !== "manager" && r !== "admin") {
    throw new AppError(403, "אין הרשאה", "FORBIDDEN");
  }
}

export async function listRooms(_req: AuthRequest, res: Response) {
  const items = await roomSvc.listRooms();
  res.json({ items });
}

export async function createRoom(req: AuthRequest, res: Response) {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await roomSvc.createRoom(parsed.data);
  res.status(201).json(item);
}

export async function patchRoom(req: AuthRequest, res: Response) {
  const parsed = patchRoomSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const item = await roomSvc.updateRoom(req.params.id, parsed.data);
  res.json(item);
}

export async function deleteRoom(req: AuthRequest, res: Response) {
  const item = await roomSvc.softDeleteRoom(req.params.id);
  res.json(item);
}

export async function listBookings(req: AuthRequest, res: Response) {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!from || !to) throw new AppError(400, "נדרשים from ו-to", "VALIDATION");
  const items = await bookingSvc.listBookings(from, to);
  res.json({ items });
}

export async function getBooking(req: AuthRequest, res: Response) {
  const item = await bookingSvc.getBooking(req.params.id);
  res.json(item);
}

export async function createBooking(req: AuthRequest, res: Response) {
  assertBooker(req);
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  ensurePartialHours(parsed.data);
  const materials = parsed.data.materials as MeetingMaterialDoc[];
  const item = await bookingSvc.createBooking({
    ...parsed.data,
    organizerId: req.user!.id,
    materials,
  });
  res.status(201).json(item);
}

export async function patchBooking(req: AuthRequest, res: Response) {
  assertBooker(req);
  const parsed = patchBookingSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const body = parsed.data;
  if (body.hourStart != null && body.hourEnd != null) ensurePartialHours(body as { hourStart: number; hourEnd: number });
  const materials = body.materials as MeetingMaterialDoc[] | undefined;
  const item = await bookingSvc.updateBooking(req.params.id, req.user!.id, req.user!.role, {
    ...body,
    materials,
  });
  res.json(item);
}

export async function deleteBooking(req: AuthRequest, res: Response) {
  assertBooker(req);
  const result = await bookingSvc.deleteBooking(req.params.id, req.user!.id, req.user!.role);
  res.json(result);
}

export const adminOnly = requireAdmin;
