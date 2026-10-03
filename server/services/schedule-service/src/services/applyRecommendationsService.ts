import type { z } from "zod";
import { AppError } from "@syt/shared";
import type { applyRecommendationsSchema } from "../validations/schedule.js";
import * as svc from "./scheduleService.js";
import * as aiBatch from "./scheduleAiBatchService.js";
import * as cycleSvc from "./departmentPreferenceCycleService.js";
import * as pref from "./attendancePreferenceService.js";
import * as notify from "./notificationClient.js";
import { enrichApplyRecommendationItems } from "./applyRecommendItemsEnrichment.js";

export type ApplyRecommendationsInput = z.infer<typeof applyRecommendationsSchema>;

/** Writes AI/manual recommendations as schedules; for pipeline batches also closes the preference cycle. */
export async function applyRecommendations(
  data: ApplyRecommendationsInput,
  options?: { autoApproved?: boolean }
) {
  const adminUserId = data.adminUserId;
  const scheduleSource = data.scheduleSource ?? "manual";

  let batchId = data.aiBatchId;
  if (scheduleSource === "ai" && adminUserId) {
    if (!batchId) {
      if (!data.aiMeta) {
        throw new AppError(400, "חסר aiMeta ליצירת אצווה AI", "VALIDATION");
      }
      const m = data.aiMeta;
      batchId = await aiBatch.createBatch({
        departmentId: m.departmentId,
        locationId: m.locationId,
        dateRange: m.dateRange,
        proposedItems: data.items.map((i) => ({
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
      await aiBatch.approveBatch(batchId, adminUserId, { autoApproved: options?.autoApproved });
    }
  }

  const enrichedCore = await enrichApplyRecommendationItems(
    data.items.map((i) => ({
      employeeId: i.employeeId,
      workDate: i.workDate,
      status: i.status,
      departmentId: i.departmentId,
      locationId: i.locationId,
      note: i.note,
    })),
    data.aiMeta
  );

  const items = enrichedCore.map((core, idx) => {
    const i = data.items[idx]!;
    return {
      ...core,
      note: core.note ?? i.note,
      updatedBy: adminUserId,
      ...(scheduleSource === "ai" && batchId
        ? { source: "ai" as const, aiBatchId: batchId }
        : { source: "manual" as const }),
    };
  });

  const results = await svc.upsertBulkInternal(items, { replaceDay: true });
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
  return { applied: results.length, results, aiBatchId: batchId };
}
