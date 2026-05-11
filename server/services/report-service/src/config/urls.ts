export const scheduleBase = () => process.env.SCHEDULE_SERVICE_URL ?? "http://localhost:4005";
export const employeeBase = () => process.env.EMPLOYEE_SERVICE_URL ?? "http://localhost:4002";
export const locationBase = () => process.env.LOCATION_SERVICE_URL ?? "http://localhost:4004";
export const notificationBase = () => process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4006";
