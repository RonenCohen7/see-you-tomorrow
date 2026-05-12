export const SOCKET_EVENTS = {
  scheduleUpdated: "schedule:updated",
  notificationNew: "notification:new",
  dashboardRefresh: "dashboard:refresh",
  occupancyUpdate: "occupancy:updated",
  /** Server → all authenticated clients; admin-triggered system message */
  systemBroadcast: "system:broadcast",
} as const;
