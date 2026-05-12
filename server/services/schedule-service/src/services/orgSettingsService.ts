import {
  DB_NAMES,
  getConnection,
  getOrganizationSettingsModel,
  AppError,
} from "@syt/shared";

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
  return {
    managerCanEditSchedules: doc.managerCanEditSchedules,
    preferenceMinDaysAhead: typeof doc.preferenceMinDaysAhead === "number" ? doc.preferenceMinDaysAhead : 7,
    preferenceRemindersEnabled: doc.preferenceRemindersEnabled !== false,
  };
}
