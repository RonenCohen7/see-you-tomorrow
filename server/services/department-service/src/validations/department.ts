import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

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

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: imageUrlField,
  locationId: objectId.optional(),
  managerId: objectId.optional(),
  isActive: z.boolean().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const listQuerySchema = z.object({
  locationId: objectId.optional(),
  isActive: z.coerce.boolean().optional(),
});
