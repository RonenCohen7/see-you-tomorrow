import type { TFunction } from "i18next";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import type { Employee, Schedule } from "../types/models";
import { addDaysIsoLocal } from "./date";
import type { SmartAlert } from "./aiSmartAlerts";
import { sortAlertsBySeverity } from "./aiSmartAlerts";

export type ParkingSpotPublic = {
  id: string;
  locationId: string;
  locationName: string;
  label: string;
  sortOrder: number;
  assignedEmployeeId?: string;
  isActive: boolean;
};

export type ParkingReservationPublic = {
  id: string;
  spotId: string;
  employeeId: string;
  guestFullName?: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  note?: string;
};

/**
 * When a spot has a fixed assignee, they are not in office on a scheduled day (explicit non-office),
 * and there is no guest reservation yet — suggest assigning the spot.
 */
export function buildParkingOpportunityAlerts(
  today: string,
  spots: ParkingSpotPublic[],
  reservations: ParkingReservationPublic[],
  schedules: Schedule[],
  employeeMap: Map<string, Employee>,
  t: TFunction
): SmartAlert[] {
  const out: SmartAlert[] = [];
  const resKey = new Set(reservations.map((r) => `${r.spotId}|${r.workDate}`));

  for (let di = 0; di <= 14; di++) {
    const dayIso = addDaysIsoLocal(today, di);
    for (const spot of spots) {
      if (!spot.isActive) continue;
      const owner = spot.assignedEmployeeId;
      if (!owner) continue;
      if (resKey.has(`${spot.id}|${dayIso}`)) continue;

      const daySched = schedules.filter((s) => s.employeeId === owner && s.workDate === dayIso);
      if (daySched.length === 0) continue;
      if (daySched.some((s) => s.status === "office")) continue;

      const ownerName = employeeMap.get(owner)?.fullName ?? owner.slice(-6);
      const loc = spot.locationName ? ` · ${spot.locationName}` : "";
      out.push({
        id: `parking-${spot.id}-${dayIso}`,
        severity: "info",
        employeeId: owner,
        employeeName: ownerName,
        title: t("parkingAlertTitle"),
        detail: t("parkingAlertDetail", { spot: spot.label, date: dayIso, loc }),
        Icon: LocalParkingIcon,
        color: "#1565c0",
      });
    }
  }

  return out;
}

export function mergeSmartAndParkingAlerts(base: SmartAlert[], parking: SmartAlert[]): SmartAlert[] {
  return sortAlertsBySeverity([...base, ...parking]);
}
