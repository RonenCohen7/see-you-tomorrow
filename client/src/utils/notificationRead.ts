import type { NotificationItem } from "../types/models";

export function isNotificationReadForUser(n: NotificationItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (n.readBy ?? []).some((r) => r.userId === userId);
}
