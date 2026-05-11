import {
  DB_NAMES,
  getConnection,
  getOrganizationSettingsModel,
} from "@syt/shared";

export async function getManagerCanEditSchedules(): Promise<boolean> {
  const conn = await getConnection(DB_NAMES.settings);
  const Model = getOrganizationSettingsModel(conn);
  let doc = await Model.findOne();
  if (!doc) {
    doc = await Model.create({ managerCanEditSchedules: false, updatedAt: new Date() });
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
