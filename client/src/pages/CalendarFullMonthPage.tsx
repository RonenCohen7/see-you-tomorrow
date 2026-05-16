import {
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import api from "../services/api";
import { currentMonthYm, todayIsoLocal } from "../utils/date";
import type { Employee, Schedule } from "../types/models";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import { useAuth, useRole } from "../store/authContext";
import { useSocket } from "../hooks/useSocket";
import type { ParkingReservationPublic, ParkingSpotPublic } from "../utils/parkingSmartAlerts";
import { dayHasLeaderOffice, leaderOfficeNamesForDay } from "../utils/aiSmartAlerts";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { CalendarDayEditorDialog } from "./CalendarDayEditorDialog";
import { MonthDayCell } from "./MonthDayCell";
import type { DayAgg } from "./calendarConstants";

function calendarStatusInlineMax(isXs: boolean) {
  return isXs ? 2 : 3;
}

export default function CalendarFullMonthPage() {
  const { ym } = useParams<{ ym: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const statusInlineMax = calendarStatusInlineMax(isXs);
  const role = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = role === "admin" || role === "manager";
  const today = todayIsoLocal();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const { socket } = useSocket(user?.id);

  const weekdayLetters = useMemo(() => {
    const raw = t("calendarWeekdayLetters", { returnObjects: true });
    return Array.isArray(raw) ? raw.map(String) : [];
  }, [t]);

  const month = useMemo(() => {
    if (ym && /^\d{4}-\d{2}$/.test(ym)) return ym;
    return currentMonthYm();
  }, [ym]);

  useEffect(() => {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
      navigate(`/calendar/month/${currentMonthYm()}`, { replace: true });
    }
  }, [ym, navigate]);

  const setMonth = (next: string) => navigate(`/calendar/month/${next}`);

  const monthEndIso = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, "0")}`;
  }, [month]);

  const birthdaysRange = useMemo(() => ({ from: `${month}-01`, to: monthEndIso }), [month, monthEndIso]);

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

  type ParkingDayRow = { spotLabel: string; guestName: string; hoursLabel: string };

  const parkingByIso = useMemo(() => {
    const spotsById = new Map((parkingSpotsQ.data ?? []).map((s) => [s.id, s.label]));
    const m = new Map<string, ParkingDayRow[]>();
    for (const r of parkingResQ.data ?? []) {
      const spotLabel = spotsById.get(r.spotId) ?? t("parkingColSpot");
      const guestName =
        r.guestFullName && r.guestFullName.length > 0 ? r.guestFullName : r.employeeId.slice(-6);
      const hoursLabel =
        r.hourStart != null || r.hourEnd != null
          ? `${r.hourStart ?? "—"}–${r.hourEnd ?? "—"}`
          : t("parkingFullDay");
      const arr = m.get(r.workDate) ?? [];
      arr.push({ spotLabel, guestName, hoursLabel });
      m.set(r.workDate, arr);
    }
    return m;
  }, [parkingResQ.data, parkingSpotsQ.data, t]);

  const monthQ = useQuery({
    queryKey: ["calendar-month", month],
    queryFn: async () => (await api.get<{ days: DayAgg[] }>(`/api/schedules/month/${month}`)).data,
  });

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
    enabled: canWrite,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeesQ.data ?? []) m.set(e.id, e);
    return m;
  }, [employeesQ.data]);

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

  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["calendar-month"] });
      void qc.invalidateQueries({ queryKey: ["calendar-next7"] });
      void qc.invalidateQueries({ queryKey: ["calendar-day"] });
      void qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
      void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
      void qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    };
    socket.on("schedule:updated", invalidate);
    socket.on("dashboard:refresh", invalidate);
    return () => {
      socket.off("schedule:updated", invalidate);
      socket.off("dashboard:refresh", invalidate);
    };
  }, [socket, qc]);

  const { weeks, monthLabel } = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const cells: ({ iso: string; agg?: DayAgg } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= last; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      cells.push({ iso, agg: monthQ.data?.days.find((x) => x._id === iso) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    const label = new Date(y, m - 1, 1).toLocaleDateString(intlTag, { month: "long", year: "numeric" });
    return { weeks: rows, monthLabel: label };
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

  const invalidateDay = async () => {
    await qc.invalidateQueries({ queryKey: ["calendar-day"] });
    await qc.invalidateQueries({ queryKey: ["calendar-next7"] });
    await qc.invalidateQueries({ queryKey: ["calendar-month"] });
    await qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
    await qc.invalidateQueries({ queryKey: ["parking-reservations"] });
    await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
  };

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
        <Button
          component={RouterLink}
          to="/calendar"
          size="small"
          startIcon={<ArrowForwardIcon sx={{ transform: "scaleX(-1)" }} />}
        >
          {t("calendarFullMonthBack")}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 0.5, flexWrap: "nowrap", gap: 1.5 }}>
        <CalendarIcon color="primary" sx={{ flexShrink: 0, mt: 0.35 }} />
        <Typography
          variant="h4"
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: { xs: "1.1rem", sm: "1.65rem" },
            lineHeight: 1.25,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {t("calendarFullMonthTitle")}
        </Typography>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1.5, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.45 }}
      >
        {t("calendarFullMonthSubtitle")}
      </Typography>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 1.25, flexWrap: "wrap", rowGap: 0.75 }}
        justifyContent="flex-end"
      >
        {STATUS_ORDER.map((k) => {
          const meta = statusMeta[k];
          return (
            <Tooltip key={k} title={t(meta.i18nKey)} arrow>
              <Box
                component="span"
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(meta.color, 0.14),
                  color: meta.color,
                  border: `1.5px solid ${alpha(meta.color, 0.5)}`,
                }}
              >
                <meta.Icon sx={{ fontSize: 14 }} />
              </Box>
            </Tooltip>
          );
        })}
        {canWrite ? (
          <Tooltip title={t("calendarManagerGapLegend")} arrow>
            <Box
              component="span"
              sx={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: alpha(theme.palette.error.main, 0.14),
                color: "error.main",
                border: `1.5px solid ${alpha(theme.palette.error.main, 0.45)}`,
              }}
            >
              <SupervisorAccountIcon sx={{ fontSize: 14 }} />
            </Box>
          </Tooltip>
        ) : null}
        <Tooltip title={t("calendarAiLegend")} arrow>
          <Box
            component="span"
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(theme.palette.secondary.main, 0.14),
              color: "secondary.main",
              border: `1.5px solid ${alpha(theme.palette.secondary.main, 0.45)}`,
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 14 }} />
          </Box>
        </Tooltip>
      </Stack>

      <Card sx={{ ...calendarCardSx, p: { xs: 0.65, sm: 1, md: 1.5 }, overflow: "hidden", width: "100%", flexShrink: 0 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 1.25 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {monthLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("calendarFullMonthGridCaption")}
            </Typography>
          </Box>
          <TextField
            type="month"
            size="small"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", sm: 160 }, maxWidth: { xs: "100%", sm: 220 } }}
          />
        </Stack>

        {monthQ.isLoading ? (
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
        ) : (
          <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Box sx={{ minWidth: 0, width: "100%" }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  gap: { xs: 0.25, sm: 0.5 },
                  mb: 1,
                  direction: theme.direction,
                }}
              >
                {weekdayLetters.map((d, wi) => (
                  <Typography
                    key={`wd-${wi}`}
                    variant="caption"
                    color="text.secondary"
                    textAlign="center"
                    sx={{ fontWeight: 700, fontSize: { xs: "0.75rem", sm: "0.8125rem" } }}
                  >
                    {d}
                  </Typography>
                ))}
              </Box>

              {weeks.map((row, ri) => (
                <Box
                  key={ri}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: { xs: 0.25, sm: 0.5 },
                    mb: 0.5,
                    direction: theme.direction,
                  }}
                >
                  {row.map((cell, ci) => {
                    if (!cell) return <Box key={ci} />;
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
                        statusInlineMax={statusInlineMax}
                        t={t}
                        onPickDay={setOpenDay}
                      />
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Card>

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
        onClose={() => setOpenDay(null)}
        onChanged={invalidateDay}
      />
    </Box>
  );
}
