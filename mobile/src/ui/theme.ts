/** Same palette as the local web app (`client/src/theme/theme.ts`). */
export const colors = {
  background: "#fafaf9",
  card: "#ffffff",
  ink: "#0f172a",
  muted: "#475569",
  line: "rgba(15,23,42,0.08)",
  orange: "#f97316",
  orangePressed: "#ea580c",
  red: "#ef4444",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  header: ["#f97316", "#ef4444", "#0ea5e9"] as const,
};

export const roleLabel: Record<string, string> = {
  admin: "מנהל מערכת",
  manager: "מנהל",
  employee: "עובד",
};
