import type { Request, Response } from "express";
import { AppError } from "@syt/shared";
import { applyRecommendationsSchema, officePresenceBatchSchema } from "../validations/schedule.js";
import * as svc from "../services/scheduleService.js";
import * as aiBatch from "../services/scheduleAiBatchService.js";
import * as cycleSvc from "../services/departmentPreferenceCycleService.js";
import * as pref from "../services/attendancePreferenceService.js";
import * as notify from "../services/notificationClient.js";
import { enrichApplyRecommendationItems } from "../services/applyRecommendItemsEnrichment.js";

export async function applyRecommendations(req: Request, res: Response) {
  const parsed = applyRecommendationsSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());

  const adminUserId = parsed.data.adminUserId;
  const scheduleSource = parsed.data.scheduleSource ?? "manual";

  let batchId = parsed.data.aiBatchId;
  if (scheduleSource === "ai" && adminUserId) {
    if (!batchId) {
      if (!parsed.data.aiMeta) {
        throw new AppError(400, "חסר aiMeta ליצירת אצווה AI", "VALIDATION");
      }
      const m = parsed.data.aiMeta;
      batchId = await aiBatch.createBatch({
        departmentId: m.departmentId,
        locationId: m.locationId,
        dateRange: m.dateRange,
        proposedItems: parsed.data.items.map((i) => ({
          date: i.workDate,
          employeeId: i.employeeId,
          recommendedStatus: i.status,
          reason: i.note,
        })),
        createdBy: adminUserId,
        approvedBy: adminUserId,
        confidence: m.confidence,
        model: m.model,
        validationNotes: m.validationNotes,
      });
    } else {
      await aiBatch.approveBatch(batchId, adminUserId);
    }
  }

  const enrichedCore = await enrichApplyRecommendationItems(
    parsed.data.items.map((i) => ({
      employeeId: i.employeeId,
      workDate: i.workDate,
      status: i.status,
      departmentId: i.departmentId,
      locationId: i.locationId,
      note: i.note,
    })),
    parsed.data.aiMeta
  );

  const items = enrichedCore.map((core, idx) => {
    const i = parsed.data.items[idx]!;
    return {
      ...core,
      note: core.note ?? i.note,
      updatedBy: adminUserId,
      ...(scheduleSource === "ai" && batchId
        ? { source: "ai" as const, aiBatchId: batchId }
        : { source: "manual" as const }),
    };
  });

  const results = await svc.upsertBulkInternal(items);
  if (batchId && scheduleSource === "ai") {
    const batch = await aiBatch.getLeanById(batchId);
    type LeanBatch = { creationSource?: string; preferenceCycleId?: { toString(): string } };
    const b = batch as LeanBatch | null;
    if (b?.creationSource === "preference_pipeline" && b.preferenceCycleId) {
      await cycleSvc.markAppliedForBatch(batchId);
      const cycle = await cycleSvc.findByBatchId(batchId);
      if (cycle) {
        const dept = cycle.departmentId.toString();
        const week = cycle.weekStartSunday;
        const rows = await pref.listDeptWeek(dept, week);
        void notify.notifyPreferencePipelineApplied({
          departmentId: dept,
          weekStartSunday: week,
          submitterEmployeeIds: rows.map((r) => r.employeeId),
        });
      }
    }
  }
  res.json({ applied: results.length, results, aiBatchId: batchId });
}

export async function officePresenceBatch(req: Request, res: Response) {
  const parsed = officePresenceBatchSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "קלט לא תקין", "VALIDATION", parsed.error.flatten());
  const results = await svc.officePresenceBatch(parsed.data.checks);
  res.json({ results });
}
