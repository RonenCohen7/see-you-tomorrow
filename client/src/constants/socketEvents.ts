/** Must match server `SOCKET_EVENTS` in @syt/shared — client keeps a mirror subset used in hooks. */
export const SOCKET_EVENTS_CLIENT = {
  systemBroadcast: "system:broadcast",
  notificationNew: "notification:new",
  dashboardRefresh: "dashboard:refresh",
} as const;
