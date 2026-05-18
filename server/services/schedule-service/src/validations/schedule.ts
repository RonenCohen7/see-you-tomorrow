import { SCHEDULE_STATUSES } from "@syt/shared";
import { z } from "zod";
import { israeliWeekDatesFromSundayUtc, utcDay } from "../utils/dateRange.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const storedScheduleStatusSchema = z.union([
  z.enum(SCHEDULE_STATUSES),
  z.string().regex(/^custom:[a-f0-9]{8,48}$/i),
]);

const optionalStoredScheduleStatusFilter = z
  .union([z.enum(SCHEDULE_STATUSES), z.string().regex(/^custom:[a-f0-9]{8,48}$/i)])
  .optional();

export const createScheduleSchema = z.object({
  employeeId: objectId,
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: storedScheduleStatusSchema,
  hours: z.number().min(0).max(24).optional(),
  note: z.string().optional(),
});

export const createScheduleRangeSchema = z
  .object({
    employeeId: objectId,
    departmentId: objectId.optional(),
    locationId: objectId.optional(),
    workDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: storedScheduleStatusSchema,
    hours: z.number().min(0).max(24).optional(),
    note: z.string().optional(),
  })
  .refine((d) => d.workDateFrom <= d.workDateTo, {
    message: "תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה",
    path: ["workDateTo"],
  });

export const updateScheduleSchema = createScheduleSchema.partial().omit({ employeeId: true });

export const replaceScheduleRangeSchema = z
  .object({
    workDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: storedScheduleStatusSchema,
    hours: z.number().min(0).max(24).optional(),
    note: z.string().optional(),
    departmentId: objectId.optional(),
    locationId: objectId.optional(),
  })
  .refine((d) => d.workDateFrom <= d.workDateTo, {
    message: "תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה",
    path: ["workDateTo"],
  });

export const departmentRangePreviewSchema = z
  .object({
    departmentId: objectId,
    workDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.workDateFrom <= d.workDateTo, {
    message: "תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה",
    path: ["workDateTo"],
  });

export const departmentRangeApplySchema = z
  .object({
    departmentId: objectId,
    workDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: storedScheduleStatusSchema,
    hours: z.number().min(0).max(24).optional(),
    note: z.string().optional(),
    includeEmployeeIds: z.array(objectId).max(200),
  })
  .refine((d) => d.workDateFrom <= d.workDateTo, {
    message: "תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה",
    path: ["workDateTo"],
  });

export const weekGridApplySchema = z
  .object({
    departmentId: objectId,
    weekStartSunday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cells: z
      .array(
        z.object({
          employeeId: objectId,
          workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          status: storedScheduleStatusSchema,
        })
      )
      .max(400),
  })
  .superRefine((data, ctx) => {
    if (utcDay(data.weekStartSunday).getUTCDay() !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekStartSunday must be a UTC Sunday",
        path: ["weekStartSunday"],
      });
      return;
    }
    let expected: Set<string>;
    try {
      expected = new Set(israeliWeekDatesFromSundayUtc(data.weekStartSunday));
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid weekStartSunday", path: ["weekStartSunday"] });
      return;
    }
    const seen = new Set<string>();
    data.cells.forEach((c, i) => {
      const k = `${c.employeeId}|${c.workDate}`;
      if (seen.has(k)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate cell",
          path: ["cells", i],
        });
      }
      seen.add(k);
      if (!expected.has(c.workDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "workDate must be within the week (Sun–Sat UTC)",
          path: ["cells", i, "workDate"],
        });
      }
    });
  });

export const listQuerySchema = z.object({
  employeeId: objectId.optional(),
  departmentId: objectId.optional(),
  locationId: objectId.optional(),
  status: optionalStoredScheduleStatusFilter,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  forecast: z.enum(["true", "false"]).optional(),
});

export const applyRecommendationsSchema = z.object({
  adminUserId: objectId.optional(),
  scheduleSource: z.enum(["manual", "ai"]).optional(),
  aiBatchId: objectId.optional(),
  aiMeta: z
    .object({
      departmentId: objectId,
      locationId: objectId.optional(),
      dateRange: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
      confidence: z.number().optional(),
      model: z.string().optional(),
      validationNotes: z.array(z.string()).optional(),
    })
    .optional(),
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
