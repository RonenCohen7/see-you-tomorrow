import { SCHEDULE_STATUSES } from "@syt/shared";
import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const recommendSchema = z.object({
  departmentId: objectId,
  locationId: objectId,
  dateRange: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  constraints: z
    .object({
      minOfficeEmployeesPerDay: z.number().min(0).optional(),
      maxOfficeCapacity: z.number().min(1).optional(),
      preferredOfficeDays: z.array(z.string()).optional(),
    })
    .optional(),
  /** רק אדמין רשאי לבקש true; מאפשר המלצות `office` בשישי–שבת (תאריך UTC). */
  allowFridaySaturdayOffice: z.boolean().optional(),
});

export const approveSchema = z.object({
  departmentId: objectId,
  locationId: objectId.optional(),
  aiBatchId: objectId.optional(),
  confidence: z.number().optional(),
  model: z.string().optional(),
  validationNotes: z.array(z.string()).optional(),
  recommendations: z.array(
    z.object({
      date: z.string(),
      employeeId: objectId,
      recommendedStatus: z.enum(SCHEDULE_STATUSES as unknown as [string, ...string[]]),
      reason: z.string().optional(),
    })
  ),
});

export const schedulingRuleDraftRequestSchema = z.object({
  naturalText: z.string().trim().min(3).max(2000),
  locations: z
    .array(
      z.object({
        id: objectId,
        name: z.string().trim().min(1).max(200),
      })
    )
    .max(200),
});

