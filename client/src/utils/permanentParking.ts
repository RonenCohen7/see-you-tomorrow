import type { ParkingSpotPublic } from "./parkingSmartAlerts";

export type PermanentParkingInfo = {
  spotId: string;
  label: string;
  locationId: string;
  locationName: string;
};

export function buildPermanentParkingByEmployee(
  spots: ParkingSpotPublic[]
): Map<string, PermanentParkingInfo> {
  const map = new Map<string, PermanentParkingInfo>();
  for (const s of spots) {
    if (!s.isActive || !s.assignedEmployeeId) continue;
    map.set(s.assignedEmployeeId, {
      spotId: s.id,
      label: s.label,
      locationId: s.locationId,
      locationName: s.locationName,
    });
  }
  return map;
}

export function spotAssignedToEmployee(spots: ParkingSpotPublic[], employeeId: string): string {
  return spots.find((s) => s.isActive && s.assignedEmployeeId === employeeId)?.id ?? "";
}

/** Vacant spots plus the employee's current spot (if any). */
export function selectablePermanentParkingSpots(
  spots: ParkingSpotPublic[],
  opts: { locationId?: string; employeeId?: string; currentSpotId?: string }
): ParkingSpotPublic[] {
  const { locationId, employeeId, currentSpotId } = opts;
  return spots
    .filter((s) => {
      if (!s.isActive) return false;
      const vacant = !s.assignedEmployeeId;
      const mine =
        Boolean(employeeId && s.assignedEmployeeId === employeeId) || s.id === currentSpotId;
      if (!vacant && !mine) return false;
      if (locationId && s.locationId !== locationId) return false;
      return true;
    })
    .sort((a, b) => {
      const loc = a.locationName.localeCompare(b.locationName, undefined, { sensitivity: "base" });
      if (loc !== 0) return loc;
      return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
}

export async function syncPermanentParkingAssignment(
  api: { patch: (url: string, body: unknown) => Promise<unknown> },
  employeeId: string,
  newSpotId: string,
  previousSpotId: string | null
): Promise<void> {
  const next = newSpotId.trim();
  const prev = previousSpotId?.trim() || "";
  if (prev && prev !== next) {
    await api.patch(`/api/parking/spots/${prev}`, { assignedEmployeeId: null });
  }
  if (next && next !== prev) {
    await api.patch(`/api/parking/spots/${next}`, { assignedEmployeeId: employeeId });
  }
}
