/** MongoDB database names per bounded context */
export const DB_NAMES = {
  auth: "syt_auth",
  employees: "syt_employees",
  departments: "syt_departments",
  locations: "syt_locations",
  schedules: "syt_schedules",
  notifications: "syt_notifications",
  settings: "syt_settings",
} as const;
