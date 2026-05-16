import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import api from "../services/api";
import { currentMonthYm, todayIsoLocal } from "../utils/date";
import type { Employee, Schedule } from "../types/models";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";
import { useRole, useAuth } from "../store/authContext";
import { useSocket } from "../hooks/useSocket";
import type { ParkingReservationPublic, ParkingSpotPublic } from "../utils/parkingSmartAlerts";
import type { MeetingBookingPublic } from "../types/meeting";
import { ManagerOfficeCoverageBanner } from "../components/ManagerOfficeCoverageBanner";
import { nextIsraeliWeekUtcFromReference } from "../utils/israeliWeek";
import { dayHasLeaderOffice, leaderOfficeNamesForDay } from "../utils/aiSmartAlerts";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { CalendarDayEditorDialog } from "./CalendarDayEditorDialog";
import { MonthDayCell } from "./MonthDayCell";
import type { DayAgg } from "./calendarConstants";

import "./CalendarPage.css";

/** Max status chips inline; fewer on phones so cells stay readable. */
function calendarStatusInlineMax(isXs: boolean) {
  return isXs ? 2 : 3;
}

function isoFromDate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function buildNext7(intlTag: string): { iso: string; weekday: number; dayNum: number; monthShort: string }[] {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      iso: isoFromDate(d),
      weekday: d.getDay(),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString(intlTag, { month: "short" }),
    });
  }
  return out;
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const navigate = useNavigate();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const statusInlineMax = calendarStatusInlineMax(isXs);
  const role = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = role === "admin" || role === "manager";
  const today = todayIsoLocal();
  const [month, setMonth] = useState(currentMonthYm());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [calTab, setCalTab] = useState(0);
  const { socket } = useSocket(user?.id);

  const weekdayLetters = useMemo(() => {
    const raw = t("calendarWeekdayLetters", { returnObjects: true });
    return Array.isArray(raw) ? raw.map(String) : [];
  }, [t]);

  const next7 = useMemo(() => buildNext7(intlTag), [intlTag]);
  const next7From = next7[0].iso;
  const next7To = next7[next7.length - 1].iso;

  const monthEndIso = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, "0")}`;
  }, [month]);

  const birthdaysRange = useMemo(() => {
    const monthStart = `${month}-01`;
    const from = monthStart < next7From ? monthStart : next7From;
    const to = monthEndIso > next7To ? monthEndIso : next7To;
    return { from, to };
  }, [month, monthEndIso, next7From, next7To]);

  const birthdaysQ = useQuery({
    queryKey: ["employees-birthdays-range", birthdaysRange.from, birthdaysRange.to],
    queryFn: async () =>
      (
        await api.get<{ items: { employeeId: string; fullName: string; date: string }[] }>(
          `/api/employees/birthdays-range?from=${birthdaysRange.from}&to=${birthdaysRange.to}`
        )
      ).data.items,
    enabled: !!user,
    staleTime: 60_000,
  });

  const birthdaysByIso = useMemo(() => {
    const m = new Map<string, { employeeId: string; fullName: string }[]>();
    for (const it of birthdaysQ.data ?? []) {
      const arr = m.get(it.date) ?? [];
      arr.push({ employeeId: it.employeeId, fullName: it.fullName });
      m.set(it.date, arr);
    }
    return m;
  }, [birthdaysQ.data]);

  const parkingSpotsQ = useQuery({
    queryKey: ["parking-spots"],
    queryFn: async () => (await api.get<{ items: ParkingSpotPublic[] }>("/api/parking/spots")).data.items,
    enabled: !!user,
    staleTime: 60_000,
  });

  const parkingResQ = useQuery({
    queryKey: ["parking-reservations", birthdaysRange.from, birthdaysRange.to],
    queryFn: async () =>
      (
        await api.get<{ items: ParkingReservationPublic[] }>(
          `/api/parking/reservations?from=${birthdaysRange.from}&to=${birthdaysRange.to}`
        )
      ).data.items,
    enabled: !!user,
    staleTime: 60_000,
  });

  const meetingBookingsQ = useQuery({
    queryKey: ["meeting-room-bookings", birthdaysRange.from, birthdaysRange.to],
    queryFn: async () =>
      (
        await api.get<{ items: MeetingBookingPublic[] }>(
          `/api/meeting-rooms/bookings?from=${birthdaysRange.from}&to=${birthdaysRange.to}`
        )
      ).data.items,
    enabled: !!user,
    staleTime: 60_000,
  });

  const meetingsByIso = useMemo(() => {
    const m = new Map<string, MeetingBookingPublic[]>();
    for (const b of meetingBookingsQ.data ?? []) {
      const arr = m.get(b.workDate) ?? [];
      arr.push(b);
      m.set(b.workDate, arr);
    }
    return m;
  }, [meetingBookingsQ.data]);

  const monthQ = useQuery({
    queryKey: ["calendar-month", month],
    queryFn: async () =>
      (await api.get<{ days: DayAgg[] }>(`/api/schedules/month/${month}`)).data,
  });

  const next7Q = useQuery({
    queryKey: ["calendar-next7", next7From, next7To],
    queryFn: async () =>
      (await api.get<{ items: Schedule[] }>(`/api/schedules?from=${next7From}&to=${next7To}`)).data,
  });

  const next7ByDay = useMemo(() => {
    const m = new Map<string, Schedule[]>();
    for (const s of next7Q.data?.items ?? []) {
      const arr = m.get(s.workDate) ?? [];
      arr.push(s);
      m.set(s.workDate, arr);
    }
    return m;
  }, [next7Q.data?.items]);

  const dayDetail = useQuery({
    queryKey: ["calendar-day", openDay],
    queryFn: async () =>
      openDay ? (await api.get<{ items: Schedule[] }>(`/api/schedules/day/${openDay}`)).data : null,
    enabled: !!openDay,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-for-calendar"],
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
    enabled: !!user,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeesQ.data ?? []) m.set(e.id, e);
    return m;
  }, [employeesQ.data]);

  type ParkingDayRow = { spotLabel: string; guestName: string; hoursLabel: string };

  const parkingByIso = useMemo(() => {
    const spotsById = new Map((parkingSpotsQ.data ?? []).map((s) => [s.id, s.label]));
    const empFullNameById = new Map((employeesQ.data ?? []).map((e) => [e.id, e.fullName]));
    const m = new Map<string, ParkingDayRow[]>();
    for (const r of parkingResQ.data ?? []) {
      const spotLabel = spotsById.get(r.spotId) ?? t("parkingColSpot");
      const guestName =
        r.guestFullName && r.guestFullName.length > 0
          ? r.guestFullName
          : (empFullNameById.get(r.employeeId) ?? `…${r.employeeId.slice(-6)}`);
      const hoursLabel =
        r.hourStart != null || r.hourEnd != null
          ? `${r.hourStart ?? "—"}–${r.hourEnd ?? "—"}`
          : t("parkingFullDay");
      const arr = m.get(r.workDate) ?? [];
      arr.push({ spotLabel, guestName, hoursLabel });
      m.set(r.workDate, arr);
    }
    return m;
  }, [parkingResQ.data, parkingSpotsQ.data, employeesQ.data, t]);

  const coverageWeek = useMemo(() => nextIsraeliWeekUtcFromReference(), [today]);

  const managerCoverageSchedulesQ = useQuery({
    queryKey: ["schedules-manager-coverage", coverageWeek.days[0], coverageWeek.days[6]],
    queryFn: async () =>
      (
        await api.get<{ items: Schedule[] }>(
          `/api/schedules?from=${coverageWeek.days[0]}&to=${coverageWeek.days[6]}`
        )
      ).data.items,
    enabled: canWrite,
    staleTime: 15_000,
  });

  const managerMonthSchedulesQ = useQuery({
    queryKey: ["schedules-manager-month", month, monthEndIso],
    queryFn: async () =>
      (await api.get<{ items: Schedule[] }>(`/api/schedules?from=${month}-01&to=${monthEndIso}`)).data.items,
    enabled: canWrite,
    staleTime: 15_000,
  });

  const monthLeaderCoverageByIso = useMemo(() => {
    const emp = employeesQ.data ?? [];
    const sched = managerMonthSchedulesQ.data ?? [];
    const ready = canWrite && !employeesQ.isLoading && !managerMonthSchedulesQ.isLoading;
    const m = new Map<string, { missing: boolean; names: string[] }>();
    if (!ready) return m;
    const [y, mm] = month.split("-").map(Number);
    const last = new Date(y, mm, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      const has = dayHasLeaderOffice(emp, sched, iso);
      m.set(iso, {
        missing: !has,
        names: leaderOfficeNamesForDay(emp, sched, iso, intlTag),
      });
    }
    return m;
  }, [
    canWrite,
    employeesQ.isLoading,
    employeesQ.data,
    managerMonthSchedulesQ.isLoading,
    managerMonthSchedulesQ.data,
    month,
    intlTag,
  ]);

  // Realtime: any schedule change → refresh all calendar queries
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["calendar-month"] });
      void qc.invalidateQueries({ queryKey: ["calendar-next7"] });
      void qc.invalidateQueries({ queryKey: ["calendar-day"] });
      void qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
      void qc.invalidateQueries({ queryKey: ["parking-spots"] });
      void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
      void qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
      void qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      void qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    };
    socket.on("schedule:updated", invalidate);
    socket.on("dashboard:refresh", invalidate);
    return () => {
      socket.off("schedule:updated", invalidate);
      socket.off("dashboard:refresh", invalidate);
    };
  }, [socket, qc]);

  const { monthLabel, preview15Days } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const take = Math.min(15, last);
    const days: { iso: string; agg?: DayAgg }[] = [];
    for (let d = 1; d <= take; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      days.push({ iso, agg: monthQ.data?.days.find((x) => x._id === iso) });
    }
    const label = new Date(y, m - 1, 1).toLocaleDateString(intlTag, { month: "long", year: "numeric" });
    return { monthLabel: label, preview15Days: days };
  }, [month, monthQ.data?.days, intlTag]);

  const calendarCardSx = useMemo(
    () => ({
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
      backgroundImage: "none",
      bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.97 : 0.998),
      boxShadow:
        theme.palette.mode === "dark"
          ? "0 2px 18px -8px rgba(0,0,0,0.55)"
          : "0 2px 18px -10px rgba(15,23,42,0.12)",
    }),
    [theme]
  );

  return (
    <Box className="calendar-page">
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 0.5, flexWrap: "nowrap", gap: 1.5 }}>
        <CalendarIcon color="primary" sx={{ flexShrink: 0, mt: 0.35 }} />
        <Typography
          variant="h4"
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: { xs: "1.15rem", sm: "1.65rem" },
            lineHeight: 1.25,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          {t("calendar")}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mb: 1,
          lineHeight: 1.45,
          minWidth: 0,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {t("calendarPageIntro")}
      </Typography>

      {canWrite ? (
        <ManagerOfficeCoverageBanner
          employees={employeesQ.data ?? []}
          schedules={managerCoverageSchedulesQ.data ?? []}
          weekDays={coverageWeek.days}
          ready={Boolean(employeesQ.data && !employeesQ.isLoading && !managerCoverageSchedulesQ.isLoading)}
        />
      ) : null}

      {/* Legend — icons only */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 1, flexWrap: "wrap", rowGap: 0.5 }}
        justifyContent="flex-end"
      >
        {STATUS_ORDER.map((k) => {
          const meta = statusMeta[k];
          return (
            <Tooltip key={k} title={t(meta.i18nKey)} arrow>
              <Avatar
                sx={{
                  width: 26,
                  height: 26,
                  bgcolor: alpha(meta.color, 0.14),
                  color: meta.color,
                  border: `1.5px solid ${alpha(meta.color, 0.5)}`,
                }}
              >
                <meta.Icon sx={{ fontSize: 14 }} />
              </Avatar>
            </Tooltip>
          );
        })}
        <Tooltip title={t("calendarParkingLegend")} arrow>
          <Avatar
            sx={{
              width: 26,
              height: 26,
              bgcolor: alpha("#1565c0", 0.14),
              color: "#1565c0",
              border: `1.5px solid ${alpha("#1565c0", 0.5)}`,
            }}
          >
            <LocalParkingIcon sx={{ fontSize: 14 }} />
          </Avatar>
        </Tooltip>
        <Tooltip title={t("calendarMeetingLegend")} arrow>
          <Avatar
            sx={{
              width: 26,
              height: 26,
              bgcolor: alpha("#00695c", 0.14),
              color: "#00695c",
              border: `1.5px solid ${alpha("#00695c", 0.5)}`,
            }}
          >
            <MeetingRoomIcon sx={{ fontSize: 14 }} />
          </Avatar>
        </Tooltip>
        {canWrite ? (
          <Tooltip title={t("calendarManagerGapLegend")} arrow>
            <Avatar
              sx={{
                width: 26,
                height: 26,
                bgcolor: alpha(theme.palette.error.main, 0.14),
                color: "error.main",
                border: `1.5px solid ${alpha(theme.palette.error.main, 0.45)}`,
              }}
            >
              <SupervisorAccountIcon sx={{ fontSize: 14 }} />
            </Avatar>
          </Tooltip>
        ) : null}
        <Tooltip title={t("calendarAiLegend")} arrow>
          <Avatar
            sx={{
              width: 26,
              height: 26,
              bgcolor: alpha(theme.palette.secondary.main, 0.14),
              color: "secondary.main",
              border: `1.5px solid ${alpha(theme.palette.secondary.main, 0.45)}`,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 14 }} />
          </Avatar>
        </Tooltip>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1, gap: 1 }}
      >
        <Tabs
          value={calTab}
          onChange={(_, v) => setCalTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            flex: 1,
            minWidth: 0,
            borderBottom: 1,
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 48, fontWeight: 700 },
          }}
        >
          <Tab label={t("calendarTabSeven")} />
          <Tab label={t("calendarTabFifteen")} />
        </Tabs>
        <TextField
          type="month"
          size="small"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flexShrink: 0, minWidth: { xs: "100%", sm: 168 }, maxWidth: { sm: 220 } }}
        />
      </Stack>

      <Box className="calendar-page__tab-scroll">
        {calTab === 0 && (
          <Card
            className="calendar-page__outer-card"
            sx={{
              ...calendarCardSx,
              p: { xs: 1, sm: 1.5, md: 2 },
            }}
          >
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, fontSize: { xs: "0.95rem", sm: "1.05rem" } }}>
              {t("calendarSevenDaysTitle")}
            </Typography>
            {next7Q.isLoading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1 }} />
            ) : (
              <Box className="calendar-page__seven-grid">
                {next7.map(({ iso, weekday, dayNum, monthShort }) => {
                  const isToday = iso === today;
                  const list = next7ByDay.get(iso) ?? [];
                  const empList = employeesQ.data ?? [];
                  const coverageDataReady = canWrite && !employeesQ.isLoading && !next7Q.isLoading;
                  const stripLeaderOfficeMissing =
                    coverageDataReady && !dayHasLeaderOffice(empList, next7Q.data?.items ?? [], iso);
                  const stripLeaderNames = leaderOfficeNamesForDay(empList, next7Q.data?.items ?? [], iso, intlTag);
                  const bdays = birthdaysByIso.get(iso) ?? [];
                  const pk = parkingByIso.get(iso) ?? [];
                  const mt = meetingsByIso.get(iso) ?? [];
                  const aiRowCount = list.filter((s) => s.source === "ai").length;
                  const byStatus = new Map<StatusKey, Set<string>>();
                  for (const s of list) {
                    if (!byStatus.has(s.status)) byStatus.set(s.status, new Set());
                    byStatus.get(s.status)!.add(s.employeeId);
                  }
                  const stripEntries = STATUS_ORDER.map((k) => ({ k, n: byStatus.get(k)?.size ?? 0 })).filter((x) => x.n > 0);
                  const stripVisible = stripEntries.slice(0, statusInlineMax);
                  const stripHidden = stripEntries.slice(statusInlineMax);
                  return (
                    <Card
                      key={iso}
                      className="calendar-page__day-card--seven"
                      elevation={0}
                      onClick={() => setOpenDay(iso)}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        overflow: "visible",
                        p: { xs: 0.8, sm: 1 },
                        border: "1px solid",
                        borderColor: stripLeaderOfficeMissing
                          ? alpha(theme.palette.error.main, 0.55)
                          : isToday
                            ? "primary.main"
                            : alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.88 : 0.98),
                        background: stripLeaderOfficeMissing
                          ? alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.08 : 0.05)
                          : isToday
                            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`
                            : alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.07 : 0.04),
                        boxShadow: stripLeaderOfficeMissing
                          ? theme.palette.mode === "dark"
                            ? "0 1px 4px rgba(0,0,0,0.42)"
                            : "0 1px 4px rgba(15,23,42,0.09)"
                          : isToday && !stripLeaderOfficeMissing
                            ? `0 2px 10px ${alpha(theme.palette.primary.main, 0.2)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`
                            : theme.palette.mode === "dark"
                              ? "0 1px 4px rgba(0,0,0,0.48)"
                              : "0 1px 4px rgba(15,23,42,0.09)",
                        transition: "box-shadow 180ms, border-color 180ms",
                        "&:hover": {
                          boxShadow: stripLeaderOfficeMissing
                            ? theme.shadows[6]
                            : isToday
                              ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.28)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}`
                              : theme.shadows[6],
                          borderColor: stripLeaderOfficeMissing
                            ? alpha(theme.palette.error.main, 0.75)
                            : isToday
                              ? "primary.dark"
                              : "primary.light",
                        },
                      }}
                    >
                      <Stack spacing={0.5} sx={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%" }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                fontSize: { xs: "0.78rem", sm: "0.85rem" },
                                fontWeight: 600,
                                minWidth: 0,
                                overflowWrap: "anywhere",
                                letterSpacing: "0.01em",
                              }}
                            >
                              {weekdayLetters[weekday] ?? ""} · {monthShort}
                            </Typography>
                          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
                            {isToday && (
                              <Chip
                                size="small"
                                label={t("today")}
                                color="primary"
                                sx={{ height: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}
                              />
                            )}
                            {aiRowCount > 0 && (
                              <Tooltip title={t("calendarAiDayHint", { count: aiRowCount })} arrow>
                                <AutoAwesomeIcon sx={{ fontSize: 16, color: "secondary.main" }} />
                              </Tooltip>
                            )}
                          </Stack>
                          </Stack>
                          <Typography
                            variant="h4"
                            sx={{
                              fontWeight: 800,
                              lineHeight: 1,
                              mt: 0.35,
                              fontSize: { xs: "1.2rem", sm: "1.5rem", md: "1.65rem" },
                              color: isToday ? "primary.main" : "text.primary",
                            }}
                          >
                            {dayNum}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                            {stripVisible.map(({ k, n }) => {
                              const meta = statusMeta[k];
                              return (
                                <Tooltip key={k} title={`${t(meta.presenceI18nKey)}: ${n}`} arrow>
                                  <Stack
                                    direction="row"
                                    spacing={0.25}
                                    alignItems="center"
                                    sx={{
                                      px: 0.55,
                                      py: 0.2,
                                      borderRadius: 1,
                                      bgcolor: alpha(meta.color, 0.14),
                                      color: meta.color,
                                      fontSize: 13,
                                      fontWeight: 800,
                                    }}
                                  >
                                    <meta.Icon sx={{ fontSize: 15 }} />
                                    <span>{n}</span>
                                  </Stack>
                                </Tooltip>
                              );
                            })}
                            {stripHidden.length > 0 ? (
                              <Tooltip
                                arrow
                                title={stripHidden
                                  .map(({ k, n }) => `${t(statusMeta[k].presenceI18nKey)}: ${n}`)
                                  .join(" · ")}
                              >
                                <Stack
                                  direction="row"
                                  spacing={0.25}
                                  alignItems="center"
                                  sx={{
                                    px: 0.55,
                                    py: 0.2,
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.text.secondary, 0.12),
                                    color: "text.secondary",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: "default",
                                  }}
                                >
                                  <span>{t("calendarMoreStatuses", { count: stripHidden.length })}</span>
                                </Stack>
                              </Tooltip>
                            ) : null}
                          </Stack>
                        </Box>

                        <Box sx={{ flex: 1, minHeight: 4, flexShrink: 0 }} aria-hidden />

                        <Stack spacing={0.5} sx={{ mt: "auto", width: "100%", minWidth: 0, pb: 0.15 }}>
                          {bdays.length > 0 && (
                            <Tooltip title={bdays.map((b) => b.fullName).join(" · ")} arrow>
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="flex-start"
                                sx={{
                                  px: 0.65,
                                  py: 0.4,
                                  borderRadius: 1.5,
                                  background: `linear-gradient(90deg, ${alpha("#ec407a", 0.2)} 0%, ${alpha("#ab47bc", 0.15)} 100%)`,
                                  border: `1px solid ${alpha("#e91e63", 0.38)}`,
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                              >
                                <CakeOutlinedIcon sx={{ fontSize: 17, color: "#c2185b", flexShrink: 0, mt: 0.15 }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 800,
                                    color: "#880e4f",
                                    fontSize: { xs: "0.72rem", sm: "0.78rem" },
                                    minWidth: 0,
                                    flex: 1,
                                    lineHeight: 1.35,
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {bdays.length === 1
                                    ? bdays[0].fullName
                                    : `${bdays.length} ${t("birthdayCalendarStrip")}`}
                                </Typography>
                              </Stack>
                            </Tooltip>
                          )}
                          {pk.length > 0 && (
                            <Tooltip
                              title={pk.map((p) => `${p.spotLabel}: ${p.guestName} (${p.hoursLabel})`).join("\n")}
                              arrow
                            >
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="flex-start"
                                sx={{
                                  px: 0.65,
                                  py: 0.4,
                                  borderRadius: 1.5,
                                  background: `linear-gradient(90deg, ${alpha("#1565c0", 0.18)} 0%, ${alpha("#0277bd", 0.12)} 100%)`,
                                  border: `1px solid ${alpha("#1565c0", 0.35)}`,
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                              >
                                <LocalParkingIcon sx={{ fontSize: 17, color: "#0d47a1", flexShrink: 0, mt: 0.15 }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 800,
                                    color: "#0d47a1",
                                    fontSize: { xs: "0.72rem", sm: "0.78rem" },
                                    minWidth: 0,
                                    flex: 1,
                                    lineHeight: 1.35,
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {pk.length === 1
                                    ? `${pk[0].spotLabel} → ${pk[0].guestName}`
                                    : `${pk.length} ${t("calendarParkingStrip")}`}
                                </Typography>
                              </Stack>
                            </Tooltip>
                          )}
                          {mt.length > 0 && (
                            <Tooltip
                              title={mt.map((m) => `${m.roomName}: ${m.title}`).join("\n")}
                              arrow
                            >
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="flex-start"
                                sx={{
                                  px: 0.65,
                                  py: 0.4,
                                  borderRadius: 1.5,
                                  background: `linear-gradient(90deg, ${alpha("#00695c", 0.18)} 0%, ${alpha("#004d40", 0.12)} 100%)`,
                                  border: `1px solid ${alpha("#00695c", 0.35)}`,
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                              >
                                <MeetingRoomIcon sx={{ fontSize: 17, color: "#004d40", flexShrink: 0, mt: 0.15 }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontWeight: 800,
                                    color: "#004d40",
                                    fontSize: { xs: "0.72rem", sm: "0.78rem" },
                                    minWidth: 0,
                                    flex: 1,
                                    lineHeight: 1.35,
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {mt.length === 1 ? `${mt[0].roomName}: ${mt[0].title}` : `${mt.length} ${t("calendarMeetingStrip")}`}
                                </Typography>
                              </Stack>
                            </Tooltip>
                          )}
                          {stripLeaderOfficeMissing ? (
                            <Typography
                              variant="caption"
                              sx={(th) => ({
                                display: "block",
                                width: "100%",
                                boxSizing: "border-box",
                                px: 0.25,
                                fontWeight: 700,
                                color: th.palette.mode === "dark" ? th.palette.error.light : th.palette.error.dark,
                                fontSize: { xs: "0.7rem", sm: "0.75rem" },
                                lineHeight: 1.35,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              })}
                            >
                              {t("calendarDayNoManagerOffice")}
                            </Typography>
                          ) : stripLeaderNames.length > 0 ? (
                            <Typography
                              variant="caption"
                              sx={(th) => ({
                                display: "block",
                                width: "100%",
                                boxSizing: "border-box",
                                px: 0.25,
                                fontWeight: 700,
                                color: th.palette.mode === "dark" ? th.palette.success.light : th.palette.success.dark,
                                fontSize: { xs: "0.7rem", sm: "0.75rem" },
                                lineHeight: 1.35,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere",
                              })}
                            >
                              {t("calendarManagersInOffice", { names: stripLeaderNames.join(" · ") })}
                            </Typography>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Card>
        )}

        {calTab === 1 && (
          <Card
            className="calendar-page__outer-card"
            sx={{
              ...calendarCardSx,
              p: { xs: 1, sm: 1.5, md: 2 },
            }}
          >
            <Stack spacing={1.25} sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: { xs: "0.95rem", sm: "1.05rem" } }}>
                  {t("calendarFifteenPreviewTitle")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {monthLabel}
                </Typography>
              </Box>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                onClick={() => navigate(`/calendar/month/${encodeURIComponent(month)}`)}
              >
                {t("calendarOpenFullMonth")}
              </Button>
            </Stack>

            {monthQ.isLoading ? (
              <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1 }} />
            ) : (
              <Box className="calendar-page__fifteen-grid">
                {preview15Days.map((cell) => {
                  const cov = monthLeaderCoverageByIso.get(cell.iso);
                  const leaderOfficeMissing = cov?.missing ?? false;
                  const leaderNamesToday = cov?.names ?? [];
                  return (
                    <MonthDayCell
                      key={cell.iso}
                      cell={cell}
                      today={today}
                      leaderOfficeMissing={leaderOfficeMissing}
                      leaderNamesToday={leaderNamesToday}
                      birthdaysByIso={birthdaysByIso}
                      parkingByIso={parkingByIso}
                      meetingsByIso={meetingsByIso}
                      statusInlineMax={statusInlineMax}
                      t={t}
                      onPickDay={(iso) => setOpenDay(iso)}
                    />
                  );
                })}
              </Box>
            )}
          </Card>
        )}
      </Box>

      <Box
        sx={(th) => ({
          mt: 1,
          pt: 1,
          pb: 0.75,
          px: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          textAlign: "center",
          borderRadius: 2,
          background: `linear-gradient(180deg, ${alpha(th.palette.primary.main, th.palette.mode === "dark" ? 0.12 : 0.06)} 0%, transparent 72%)`,
        })}
      >
        <Typography
          component="p"
          lang="en"
          variant="subtitle1"
          sx={(th) => ({
            direction: "ltr",
            display: "block",
            maxWidth: "100%",
            mx: "auto",
            fontStyle: "italic",
            letterSpacing: "0.045em",
            fontWeight: 600,
            fontSize: { xs: "0.95rem", sm: "1.1rem" },
            lineHeight: 1.45,
            overflowWrap: "anywhere",
            color: alpha(th.palette.text.primary, th.palette.mode === "dark" ? 0.88 : 0.7),
          })}
        >
          {t("taglineCalendar")}
        </Typography>
      </Box>

      <CalendarDayEditorDialog
        open={!!openDay}
        date={openDay}
        fullScreen={isXs}
        items={dayDetail.data?.items ?? []}
        loading={dayDetail.isLoading}
        employeeMap={employeeMap}
        employees={employeesQ.data ?? []}
        canWrite={canWrite}
        birthdaysOnDate={openDay ? (birthdaysByIso.get(openDay) ?? []) : []}
        parkingOnDate={openDay ? (parkingByIso.get(openDay) ?? []) : []}
        parkingSpots={parkingSpotsQ.data ?? []}
        parkingDayReservations={openDay ? (parkingResQ.data ?? []).filter((r) => r.workDate === openDay) : []}
        meetingsOnDate={openDay ? (meetingsByIso.get(openDay) ?? []) : []}
        onClose={() => setOpenDay(null)}
        onChanged={async () => {
          await qc.invalidateQueries({ queryKey: ["calendar-day"] });
          await qc.invalidateQueries({ queryKey: ["calendar-next7"] });
          await qc.invalidateQueries({ queryKey: ["calendar-month"] });
          await qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
          await qc.invalidateQueries({ queryKey: ["parking-reservations"] });
          await qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
          await qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
          await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
        }}
      />
    </Box>
  );
}
