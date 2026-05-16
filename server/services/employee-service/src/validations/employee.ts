import { z } from "zod";
import { MARITAL_STATUSES } from "@syt/shared";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** HTTP(S) URL or inline JPEG/PNG/WebP data URL (client should resize before send). */
const imageUrlField = z
  .union([
    z.string().url(),
    z
      .string()
      .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/i)
      .max(2_000_000),
    z.literal(""),
  ])
  .optional();

export const createEmployeeSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  imageUrl: imageUrlField,
  jobTitle: z.string().optional(),
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  managerId: objectId.optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  isActive: z.boolean().optional(),
  birthDate: isoDate.optional().or(z.literal("")),
  address: z.string().optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional().or(z.literal("")),
  emergencyContact: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  password: z.string().min(8).optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const bulkImportRowSchema = createEmployeeSchema.omit({ password: true });

export const bulkImportEmployeesSchema = z.object({
  defaultPassword: z.string().min(8),
  rows: z.array(bulkImportRowSchema).min(1).max(5000),
});
