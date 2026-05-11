import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  capacity: z.number().min(0),
  isActive: z.boolean().optional(),
});

export const updateLocationSchema = createLocationSchema.partial();

export const listQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
});
