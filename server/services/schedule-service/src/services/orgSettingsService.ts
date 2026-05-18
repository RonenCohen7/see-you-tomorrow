import {
  DB_NAMES,
  getConnection,
  getOrganizationSettingsModel,
  AppError,
  SCHEDULE_STATUSES,
  type CustomScheduleStatusDef,
  type ScheduleStatus,
} from "@syt/shared";
import { randomBytes } from "node:crypto";

const MAX_CUSTOM_SCHEDULE_STATUSES = 40;

function normalizeCustomStatusesInput(body: unknown): CustomScheduleStatusDef[] {
  if (!Array.isArray(body)) {
    throw new AppError(400, "customScheduleStatuses חייבת להיות מערך", "VALIDATION");
  }
  if (body.length > MAX_CUSTOM_SCHEDULE_STATUSES) {
    throw new AppError(400, `לכל היותר ${MAX_CUSTOM_SCHEDULE_STATUSES} סטטוסים מותאמים`, "VALIDATION");
  }
  const out: CustomScheduleStatusDef[] = [];
  const seen = new Set<string>();
  for (const row of body) {
    if (!row || typeof row !== "object") {
      throw new AppError(400, "רשומת סטטוס לא תקינה", "VALIDATION");
    }
    const raw = row as Record<string, unknown>;
    let id = typeof raw.id === "string" ? raw.id.trim() : "";
    const labelHe = typeof raw.labelHe === "string" ? raw.labelHe.trim() : "";
    const labelEn =
      raw.labelEn != null && String(raw.labelEn).trim() !== "" ? String(raw.labelEn).trim().slice(0, 120) : undefined;
    if (labelHe.length < 1 || labelHe.length > 120) {
      throw new AppError(400, "labelHe באורך 1–120 תווים", "VALIDATION");
    }
    if (!id) {
      id = randomBytes(12).toString("hex");
    } else if (!/^[a-f0-9]{8,48}$/i.test(id)) {
      throw new AppError(400, "מזהה סטטוס מותאם לא תקין", "VALIDATION");
    }
    const disabled = raw.disabled === true;
    if (seen.has(id)) {
      throw new AppError(400, "כפילות במזהי סטטוס מותאם", "VALIDATION");
    }
    seen.add(id);
    const def: CustomScheduleStatusDef =
      disabled && labelEn !== undefined
        ? { id, labelHe, labelEn, disabled: true }
        : disabled
          ? { id, labelHe, disabled: true }
          : labelEn !== undefined
            ? { id, labelHe, labelEn }
            : { id, labelHe };
    out.push(def);
  }
  return out;
}
export async function getManagerCanEditSchedules(): Promise<boolean> {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create({
      managerCanEditSchedules: false,
      preferenceMinDaysAhead: 7,
      preferenceRemindersEnabled: true,
      updatedAt: new Date(),
    });
  }
  return doc.managerCanEditSchedules;
}

export async function setManagerCanEditSchedules(value: boolean) {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  await Model.findOneAndUpdate(
    {},
    { managerCanEditSchedules: value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}

export async function getPreferenceMinDaysAhead(): Promise<number> {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create({
      managerCanEditSchedules: false,
      preferenceMinDaysAhead: 7,
      preferenceRemindersEnabled: true,
      updatedAt: new Date(),
    });
  }
  return typeof doc.preferenceMinDaysAhead === "number" ? doc.preferenceMinDaysAhead : 7;
}

export async function getPreferenceRemindersEnabled(): Promise<boolean> {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create({
      managerCanEditSchedules: false,
      preferenceMinDaysAhead: 7,
      preferenceRemindersEnabled: true,
      updatedAt: new Date(),
    });
  }
  return doc.preferenceRemindersEnabled !== false;
}

export async function patchOrgSchedulesPrefs(input: {
  preferenceMinDaysAhead?: number;
  preferenceRemindersEnabled?: boolean;
}) {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.preferenceMinDaysAhead !== undefined) {
    if (input.preferenceMinDaysAhead < 0 || input.preferenceMinDaysAhead > 60) {
      throw new AppError(400, "preferenceMinDaysAhead בין 0 ל-60", "VALIDATION");
    }
    patch.preferenceMinDaysAhead = input.preferenceMinDaysAhead;
  }
  if (input.preferenceRemindersEnabled !== undefined) {
    patch.preferenceRemindersEnabled = input.preferenceRemindersEnabled;
  }
  const doc = await Model.findOneAndUpdate({}, { $set: patch }, { upsert: true, new: true });
  return doc!;
}

export async function setOrgCustomScheduleStatuses(list: unknown) {
  const normalized = normalizeCustomStatusesInput(list);
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  await Model.findOneAndUpdate(
    {},
    { $set: { customScheduleStatuses: normalized, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
}

export async function setDisabledBuiltinScheduleStatuses(body: unknown) {
  if (!Array.isArray(body)) {
    throw new AppError(400, "disabledBuiltinScheduleStatuses חייבת להיות מערך", "VALIDATION");
  }
  const allowed = new Set(SCHEDULE_STATUSES as readonly ScheduleStatus[]);
  const ids: ScheduleStatus[] = [];
  const seenIn = new Set<string>();
  for (const raw of body) {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (!allowed.has(s as ScheduleStatus)) {
      throw new AppError(400, `סטטוס מובנה לא תקין: ${s || "(ריק)"}`, "VALIDATION");
    }
    if (seenIn.has(s)) continue;
    seenIn.add(s);
    ids.push(s as ScheduleStatus);
  }
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  await Model.findOneAndUpdate(
    {},
    { $set: { disabledBuiltinScheduleStatuses: ids, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
}

export async function getOrgSchedulesFull() {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create({
      managerCanEditSchedules: false,
      preferenceMinDaysAhead: 7,
      preferenceRemindersEnabled: true,
      updatedAt: new Date(),
    });
  }
  const customs = Array.isArray(doc.customScheduleStatuses) ? doc.customScheduleStatuses : [];
  const disabledBuiltinsRaw = Array.isArray(doc.disabledBuiltinScheduleStatuses)
    ? doc.disabledBuiltinScheduleStatuses
    : [];
  const disabledBuiltinScheduleStatuses = disabledBuiltinsRaw.filter((s): s is ScheduleStatus =>
    (SCHEDULE_STATUSES as readonly string[]).includes(String(s)),
  );

  return {
    managerCanEditSchedules: doc.managerCanEditSchedules,
    preferenceMinDaysAhead: typeof doc.preferenceMinDaysAhead === "number" ? doc.preferenceMinDaysAhead : 7,
    preferenceRemindersEnabled: doc.preferenceRemindersEnabled !== false,
    disabledBuiltinScheduleStatuses,
    customScheduleStatuses: customs.map((c): CustomScheduleStatusDef => {
      const base: CustomScheduleStatusDef = c.labelEn?.trim()
        ? { id: String(c.id), labelHe: String(c.labelHe), labelEn: String(c.labelEn) }
        : { id: String(c.id), labelHe: String(c.labelHe) };
      if (c.disabled === true) base.disabled = true;
      return base;
    }),
  };
}
