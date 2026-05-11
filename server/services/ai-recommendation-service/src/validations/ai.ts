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
});

export const approveSchema = z.object({
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  recommendations: z.array(
    z.object({
      date: z.string(),
      employeeId: objectId,
      recommendedStatus: z.enum(SCHEDULE_STATUSES as unknown as [string, ...string[]]),
      reason: z.string().optional(),
    })
  ),
});
