export type AppScreen =
  | "calendar"
  | "preferences"
  | "employees"
  | "departments"
  | "locations"
  | "myParking"
  | "parking"
  | "teamPreferences"
  | "notifications"
  | "ai"
  | "support"
  | "settings"
  | "schedulingRules";

/** Same doors as the local website navigation. */
export function canOpen(role: string | undefined, screen: AppScreen): boolean {
  const normalized = role?.trim().toLowerCase();
  if (screen === "calendar" || screen === "myParking" || screen === "support") {
    return normalized === "admin" || normalized === "manager" || normalized === "employee";
  }
  if (screen === "preferences") return normalized === "employee" || normalized === "manager";
  if (
    screen === "parking" ||
    screen === "teamPreferences" ||
    screen === "notifications" ||
    screen === "ai" ||
    screen === "schedulingRules"
  ) {
    return normalized === "admin" || normalized === "manager";
  }
  if (screen === "employees") return normalized === "admin" || normalized === "manager";
  if (screen === "departments" || screen === "locations" || screen === "settings") {
    return normalized === "admin";
  }
  return false;
}
