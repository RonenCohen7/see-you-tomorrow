export const ROLES = ["admin", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];
