import { SCHEDULE_STATUSES } from "@syt/shared";
import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

export const createScheduleSchema = z.object({
  employeeId: objectId,
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(SCHEDULE_STATUSES),
  hours: z.number().min(0).max(24).optional(),
  note: z.string().optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial().omit({ employeeId: true });

export const listQuerySchema = z.object({
  employeeId: objectId.optional(),
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  status: z.enum(SCHEDULE_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  forecast: z.enum(["true", "false"]).optional(),
});

export const applyRecommendationsSchema = z.object({
  items: z.array(
    z.object({
      employeeId: objectId,
      workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(SCHEDULE_STATUSES),
      departmentId: objectId.optional(),
      locationId: objectId.optional(),
      note: z.string().optional(),
    })
  ),
});

export const officePresenceBatchSchema = z.object({
  checks: z
    .array(
      z.object({
        employeeId: objectId,
        workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .max(500),
});
