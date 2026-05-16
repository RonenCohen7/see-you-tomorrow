/**
 * Department & location **list** APIs accept optional `isActive` (server coerces query string → boolean).
 * Use these URLs for picker / assignment dropdowns — never offer inactive departments or locations as defaults.
 */

export const PICK_ACTIVE_ONLY_QS = "?isActive=true";

export function departmentsPickerUrl(): string {
  return `/api/departments${PICK_ACTIVE_ONLY_QS}`;
}

export function locationsPickerUrl(): string {
  return `/api/locations${PICK_ACTIVE_ONLY_QS}`;
}
