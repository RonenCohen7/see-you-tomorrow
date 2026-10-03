import { Queue, Worker } from "bullmq";
import { forEachActiveTenant, getRequestTenantSlug, internalServiceHeaders, isSharedSaasMode, logger, runWithTenant } from "@syt/shared";
import { israeliWeekDatesFromSundayUtc, utcDay } from "../utils/dateRange.js";
import * as cycleSvc from "./departmentPreferenceCycleService.js";
import * as batchSvc from "./scheduleAiBatchService.js";
import * as pref from "./attendancePreferenceService.js";
import * as remoteDepartment from "./remoteDepartment.js";
import * as remoteLocation from "./remoteLocation.js";
import { resolveSystemActorEmployeeId } from "./systemActorEmployee.js";
import * as notify from "./notificationClient.js";
import { defaultAiConstraints, findPipelineExceptions } from "./pipelineExceptions.js";
import { applyRecommendations } from "./applyRecommendationsService.js";

const QUEUE_NAME = "dept-preference-ai";

function redisConnection(): { host: string; port: number; password?: string } {
  const urlStr = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const u = new URL(urlStr);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 6379,
      password: u.password || undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

/** דיבאונס BullMQ לפני ריצת AI אחרי הגשת העדפות — קיבוע עליון 10 שניות (גם אם ב-.env גבוה יותר). */
const PREFERENCE_AI_DEBOUNCE_MAX_MS = 10_000;

export function debounceMs(): number {
  const raw = Number(process.env.PREFERENCE_AI_DEBOUNCE_MS ?? PREFERENCE_AI_DEBOUNCE_MAX_MS);
  if (!Number.isFinite(raw)) return PREFERENCE_AI_DEBOUNCE_MAX_MS;
  return Math.min(PREFERENCE_AI_DEBOUNCE_MAX_MS, Math.max(0, raw));
}

/** Batches without exceptions are applied immediately; set PREFERENCE_AI_AUTO_APPROVE=false to always wait for a manager. */
function autoApproveEnabled(): boolean {
  return (process.env.PREFERENCE_AI_AUTO_APPROVE ?? "true").trim().toLowerCase() !== "false";
}

export async function enqueuePreferenceAiJob(departmentId: string, weekStartSunday: string) {
  const connection = redisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });
  const tenantSlug = getRequestTenantSlug() ?? "";
  const jobId = `${tenantSlug}|${departmentId}|${weekStartSunday}`;
  try {
    const existing = await queue.getJob(jobId);
    if (existing) await existing.remove();
  } catch {
    /* ignore */
  }
  try {
    await queue.add(
      "run",
      { departmentId, weekStartSunday, tenantSlug: tenantSlug || undefined },
      {
        jobId,
        delay: debounceMs(),
        removeOnComplete: true,
        removeOnFail: 25,
      }
    );
  } catch (err) {
    /**
     * Likely Redis is unreachable. Don't fail the user's submission — the cycle
     * is already persisted with pipelineStatus="queued", and the worker
     * recovery on startup will re-enqueue it when Redis is back.
     */
    logger.error("preference AI enqueue failed (will recover on worker start)", err);
  }
}

async function callInternalRecommend(body: Record<string, unknown>) {
  const base = process.env.AI_SERVICE_URL ?? "http://localhost:4007";
  const res = await fetch(`${base}/internal/recommend-schedule`, {
    method: "POST",
    headers: internalServiceHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`internal recommend ${res.status}: ${t.slice(0, 400)}`);
  }
  return res.json() as Promise<{
    recommendations: Array<{ date: string; employeeId: string; recommendedStatus: string; reason?: string }>;
    confidence?: number;
    model?: string;
    validation?: { ok: true } | { ok: false; errors: string[] };
    preferenceVsRecommendation?: {
      matchedPreference?: number;
      differsFromPreference?: number;
      noSubmittedPreferenceForSlot?: number;
      recommendationRows?: number;
    };
  }>;
}

/**
 * Re-enqueue cycles that are stuck pre-batch — typically because Redis was
 * unreachable when an employee submitted preferences, or the worker died
 * mid-run. Safe to call repeatedly: BullMQ deduplicates on jobId.
 */
async function recoverStuckPreBatchJobs(queue: Queue) {
  try {
    const stuck = await cycleSvc.listStuckPreBatchCycles();
    if (stuck.length === 0) return;
    logger.info(`preference AI worker recovery: re-enqueueing ${stuck.length} stuck cycle(s)`);
    for (const c of stuck) {
      try {
        await cycleSvc.resetToQueued(c.departmentId, c.weekStartSunday);
        const tenantSlug = getRequestTenantSlug() ?? "";
        const jobId = `${tenantSlug}|${c.departmentId}|${c.weekStartSunday}`;
        const existing = await queue.getJob(jobId);
        if (existing) await existing.remove().catch(() => undefined);
        await queue.add(
          "run",
          {
            departmentId: c.departmentId,
            weekStartSunday: c.weekStartSunday,
            tenantSlug: tenantSlug || undefined,
          },
          { jobId, delay: 0, removeOnComplete: true, removeOnFail: 25 }
        );
      } catch (err) {
        logger.error("preference AI recovery: failed to enqueue", err);
      }
    }
  } catch (err) {
    logger.error("preference AI recovery scan failed", err);
  }
}

export function startPreferenceAiPipelineWorker() {
  const connection = redisConnection();
  const queue = new Queue(QUEUE_NAME, { connection });

  forEachActiveTenant(async () => {
    await recoverStuckPreBatchJobs(queue);
  }).catch((err) => logger.error("preference AI recovery: tenant scan failed", err));

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data as {
        departmentId: string;
        weekStartSunday: string;
        tenantSlug?: string;
      };
      if (isSharedSaasMode() && !data.tenantSlug) {
        logger.error("preference AI job missing tenant", { id: job.id });
        return;
      }
      await runWithTenant(data.tenantSlug ?? null, async () => {
      const { departmentId, weekStartSunday } = data;

      const doc = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
      if (!doc || doc.pipelineStatus !== "queued") {
        logger.info("preference AI job skip (not queued)", { departmentId, weekStartSunday });
        return;
      }

      await cycleSvc.markRunning(doc);

      const days = israeliWeekDatesFromSundayUtc(weekStartSunday);
      const dateRange = { from: days[0]!, to: days[6]! };
      const submittedRows = await pref.listDeptWeek(departmentId, weekStartSunday);
      const submitterIds = submittedRows.map((r) => r.employeeId);

      const dept = await remoteDepartment.fetchDepartmentPublic(departmentId);
      const locationId = dept?.locationId || (await remoteLocation.fetchDefaultLocationId());
      if (!locationId) {
        const msg = "לא הוגדר אף מיקום פעיל בחברה — לא ניתן להפעיל המלצת AI אוטומטית.";
        const cycleFail = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
        if (cycleFail) await cycleSvc.markFailed(cycleFail, msg);
        void notify.notifyPreferencePipelineNoLocation({
          departmentId,
          weekStartSunday,
          submitterEmployeeIds: submitterIds,
        });
        return;
      }

      const constraints = defaultAiConstraints();
      let aiJson: Awaited<ReturnType<typeof callInternalRecommend>>;
      try {
        aiJson = await callInternalRecommend({
          departmentId,
          locationId,
          dateRange,
          constraints,
          actingUserId: await resolveSystemActorEmployeeId().catch(() => undefined),
        });
      } catch (e) {
        const cycleFail = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
        const errMsg = e instanceof Error ? e.message : String(e);
        if (cycleFail && cycleFail.pipelineStatus === "ai_running") {
          await cycleSvc.markFailed(cycleFail, errMsg);
        }
        void notify.notifyPreferencePipelineAiFailed({
          departmentId,
          weekStartSunday,
          submitterEmployeeIds: submitterIds,
          message: "שגיאת שרת בהפעלת ההמלצה האוטומטית.",
        });
        logger.error("preference AI internal recommend failed", e);
        throw e;
      }

      const validation = aiJson.validation;
      if (!validation || validation.ok === false) {
        const errors =
          validation && validation.ok === false ? validation.errors.join("; ") : "ולידציית שיבוץ נכשלה";
        const cycleFail = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
        if (cycleFail && cycleFail.pipelineStatus === "ai_running") {
          await cycleSvc.markFailed(cycleFail, errors);
        }
        void notify.notifyPreferencePipelineAiFailed({
          departmentId,
          weekStartSunday,
          submitterEmployeeIds: submitterIds,
          message: errors.slice(0, 500),
        });
        void notify.notifyPreferencePipelineValidationIssueManagers({
          departmentId,
          weekStartSunday,
          message: errors.slice(0, 500),
        });
        return;
      }

      const systemActorId = await resolveSystemActorEmployeeId();
      const prefs = aiJson.preferenceVsRecommendation;
      const proposedItems = (aiJson.recommendations ?? []).map((r) => ({
        date: r.date,
        employeeId: r.employeeId,
        recommendedStatus: r.recommendedStatus as import("@syt/shared").ScheduleStatus,
        reason: r.reason,
      }));

      const cycleReady = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
      const cycleOid = cycleReady?._id.toString();

      const exceptions = findPipelineExceptions({
        items: proposedItems,
        submitted: submittedRows,
        minOfficePerDay: constraints.minOfficeEmployeesPerDay,
        maxOfficeCapacity: constraints.maxOfficeCapacity,
      });

      const batchId = await batchSvc.createBatch({
        departmentId,
        locationId,
        dateRange,
        proposedItems,
        createdBy: systemActorId,
        status: "pending_manager",
        creationSource: "preference_pipeline",
        preferenceCycleId: cycleOid,
        confidence: aiJson.confidence,
        model: aiJson.model,
        exceptions,
      });

      const cycleAfter = await cycleSvc.loadForUpdate(departmentId, weekStartSunday);
      if (cycleAfter && cycleAfter.pipelineStatus === "ai_running") {
        await cycleSvc.markAwaitingManager(cycleAfter, batchId, {
          matchedPreference: prefs?.matchedPreference,
          differsFromPreference: prefs?.differsFromPreference,
          noSubmittedPreferenceForSlot: prefs?.noSubmittedPreferenceForSlot,
          recommendationRows: prefs?.recommendationRows,
        });
      }

      if (exceptions.length === 0 && autoApproveEnabled()) {
        try {
          await applyRecommendations(
          {
            adminUserId: systemActorId,
            scheduleSource: "ai",
            aiBatchId: batchId,
            items: proposedItems.map((p) => ({
              employeeId: p.employeeId,
              workDate: p.date,
              status: p.recommendedStatus,
              departmentId,
              locationId,
              note: (p.reason ? `${p.reason}\n` : "") + "שובץ אוטומטית על ידי AI — ללא חריגים, לא נדרש אישור מנהל.",
            })),
          },
          { autoApproved: true }
          );
          logger.info("preference AI batch auto-approved", { departmentId, weekStartSunday, batchId });
          return;
        } catch (err) {
          logger.error("preference AI auto-approve failed — left for manager approval", err);
        }
      }

      void notify.notifyPreferencePipelineAiReady({
        departmentId,
        weekStartSunday,
        batchId,
        submitterEmployeeIds: submitterIds,
        summary: prefs,
      });
      void notify.notifyPreferencePipelineBatchPendingManagers({
        departmentId,
        weekStartSunday,
        batchId,
      });
      });
    },
    { connection, concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    logger.error(`preference AI job ${job?.id} failed`, err);
  });

  return { worker, queue };
}

export function canEnqueuePreferenceAi(weekStartSunday: string): boolean {
  try {
    return utcDay(weekStartSunday).getUTCDay() === 0;
  } catch {
    return false;
  }
}
