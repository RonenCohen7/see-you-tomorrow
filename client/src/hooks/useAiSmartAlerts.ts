import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import type { Employee, Schedule } from "../types/models";
import { addDaysIsoLocal, todayIsoLocal } from "../utils/date";
import { alertsSignature, buildSmartAlerts, sortAlertsBySeverity } from "../utils/aiSmartAlerts";
import { buildJewishHolidayAlerts } from "../utils/jewishHolidayAlerts";
import { buildTrafficAwarenessAlert, fetchWeatherSmartAlerts } from "../utils/weatherTrafficAlerts";
import {
  buildParkingOpportunityAlerts,
  mergeSmartAndParkingAlerts,
  type ParkingReservationPublic,
  type ParkingSpotPublic,
} from "../utils/parkingSmartAlerts";

/**
 * Shared data for AI “smart alerts” (heuristic). Used by /ai and by the floating insight chip.
 * Includes parking opportunities when fixed assignees are not in office.
 */
export function useAiSmartAlerts(enabled: boolean) {
  const { t } = useTranslation();
  const today = todayIsoLocal();
  const fromIso = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const parkingToIso = useMemo(() => addDaysIsoLocal(today, 14), [today]);

  const employeesQ = useQuery({
    queryKey: ["employees-all-for-ai"],
    queryFn: async () => {
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=100`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return all;
    },
    enabled,
    staleTime: 30_000,
  });

  const schedulesQ = useQuery({
    queryKey: ["schedules-recent", fromIso, today],
    queryFn: async () =>
      (await api.get<{ items: Schedule[] }>(`/api/schedules?from=${fromIso}&to=${today}`)).data.items,
    enabled,
    staleTime: 15_000,
  });

  const schedulesForwardQ = useQuery({
    queryKey: ["schedules-forward-parking", today, parkingToIso],
    queryFn: async () =>
      (await api.get<{ items: Schedule[] }>(`/api/schedules?from=${today}&to=${parkingToIso}`)).data.items,
    enabled,
    staleTime: 15_000,
  });

  const parkingSpotsQ = useQuery({
    queryKey: ["parking-spots"],
    queryFn: async () => (await api.get<{ items: ParkingSpotPublic[] }>("/api/parking/spots")).data.items,
    enabled,
    staleTime: 30_000,
  });

  const parkingResQ = useQuery({
    queryKey: ["parking-reservations", today, parkingToIso],
    queryFn: async () =>
      (await api.get<{ items: ParkingReservationPublic[] }>(`/api/parking/reservations?from=${today}&to=${parkingToIso}`))
        .data.items,
    enabled,
    staleTime: 15_000,
  });

  const weatherAlertsQ = useQuery({
    queryKey: ["ai-weather-alerts", today],
    queryFn: () => fetchWeatherSmartAlerts(today, t),
    enabled,
    staleTime: 3_600_000,
  });

  const alerts = useMemo(() => {
    if (!employeesQ.data || !schedulesQ.data || !schedulesForwardQ.data) return [];
    const empMap = new Map(employeesQ.data.map((e) => [e.id, e]));
    const base = buildSmartAlerts(employeesQ.data, schedulesQ.data, t);
    const spots = parkingSpotsQ.data ?? [];
    const res = parkingResQ.data ?? [];
    const parkingAlerts = buildParkingOpportunityAlerts(today, spots, res, schedulesForwardQ.data, empMap, t);
    const holidayAlerts = buildJewishHolidayAlerts(today, t);
    const weatherAlerts = weatherAlertsQ.data ?? [];
    const trafficAlert = buildTrafficAwarenessAlert(t);
    const merged = mergeSmartAndParkingAlerts(base, parkingAlerts);
    return sortAlertsBySeverity([...holidayAlerts, ...weatherAlerts, trafficAlert, ...merged]);
  }, [
    employeesQ.data,
    parkingResQ.data,
    parkingSpotsQ.data,
    schedulesForwardQ.data,
    schedulesQ.data,
    t,
    today,
    weatherAlertsQ.data,
  ]);

  const signature = useMemo(() => alertsSignature(alerts), [alerts]);

  const loading =
    employeesQ.isLoading ||
    schedulesQ.isLoading ||
    schedulesForwardQ.isLoading ||
    parkingSpotsQ.isLoading ||
    parkingResQ.isLoading ||
    weatherAlertsQ.isLoading;

  const refetch = () => {
    void employeesQ.refetch();
    void schedulesQ.refetch();
    void schedulesForwardQ.refetch();
    void parkingSpotsQ.refetch();
    void parkingResQ.refetch();
    void weatherAlertsQ.refetch();
  };

  return { alerts, signature, loading, refetch };
}
