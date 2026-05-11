import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
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
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/AddCircle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import api from "../services/api";
import { currentMonthYm, todayIsoLocal } from "../utils/date";
import type { Employee, Schedule } from "../types/models";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";
import { useRole, useAuth } from "../store/authContext";
import { useSocket } from "../hooks/useSocket";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import type { ParkingReservationPublic, ParkingSpotPublic } from "../utils/parkingSmartAlerts";

type DayAgg = { _id: string; office: number; home: number; vacation: number; sick: number; off: number };

const HEBREW_WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HEBREW_WEEKDAYS_FULL = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

function isoFromDate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function buildNext10(): { iso: string; weekday: number; dayNum: number; monthShort: string }[] {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 10; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push({
      iso: isoFromDate(d),
      weekday: d.getDay(),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString("he-IL", { month: "short" }),
    });
  }
  return out;
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const role = useRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canWrite = role === "admin" || role === "manager";
  const today = todayIsoLocal();
  const [month, setMonth] = useState(currentMonthYm());
  const [openDay, setOpenDay] = useState<string | null>(null);
  const { socket } = useSocket(user?.id);

  const next10 = useMemo(buildNext10, []);
  const next10From = next10[0].iso;
  const next10To = next10[next10.length - 1].iso;

  const monthEndIso = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, "0")}`;
  }, [month]);

  const birthdaysRange = useMemo(() => {
    const monthStart = `${month}-01`;
    const from = monthStart < next10From ? monthStart : next10From;
    const to = monthEndIso > next10To ? monthEndIso : next10To;
    return { from, to };
  }, [month, monthEndIso, next10From, next10To]);

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
      const spotLabel = spotsById.get(r.spotId) ?? "חניה";
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
    queryFn: async () =>
      (await api.get<{ days: DayAgg[] }>(`/api/schedules/month/${month}`)).data,
  });

  const next10Q = useQuery({
    queryKey: ["calendar-next10", next10From, next10To],
    queryFn: async () =>
      (await api.get<{ items: Schedule[] }>(`/api/schedules?from=${next10From}&to=${next10To}`)).data,
  });

  const next10ByDay = useMemo(() => {
    const m = new Map<string, Schedule[]>();
    for (const s of next10Q.data?.items ?? []) {
      const arr = m.get(s.workDate) ?? [];
      arr.push(s);
      m.set(s.workDate, arr);
    }
    return m;
  }, [next10Q.data?.items]);

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

  // Realtime: any schedule change → refresh all calendar queries
  useEffect(() => {
    if (!socket) return;
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["calendar-month"] });
      void qc.invalidateQueries({ queryKey: ["calendar-next10"] });
      void qc.invalidateQueries({ queryKey: ["calendar-day"] });
      void qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
      void qc.invalidateQueries({ queryKey: ["parking-spots"] });
      void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
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
    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    const label = new Date(y, m - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
    return { weeks: rows, monthLabel: label };
  }, [month, monthQ.data?.days]);

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
        <CalendarIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
          {t("calendar")}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.5 }}>
        תצוגה מהירה של 10 ימים קדימה, ולמטה החודש המלא — לחץ על יום לעריכת הסטטוסים
      </Typography>

      {/* Legend — icons only */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}
        justifyContent="flex-end"
      >
        {STATUS_ORDER.map((k) => {
          const meta = statusMeta[k];
          return (
            <Tooltip key={k} title={t(meta.i18nKey)} arrow>
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  bgcolor: alpha(meta.color, 0.14),
                  color: meta.color,
                  border: `1.5px solid ${alpha(meta.color, 0.5)}`,
                }}
              >
                <meta.Icon sx={{ fontSize: 16 }} />
              </Avatar>
            </Tooltip>
          );
        })}
        <Tooltip title={t("calendarParkingLegend")} arrow>
          <Avatar
            sx={{
              width: 30,
              height: 30,
              bgcolor: alpha("#1565c0", 0.14),
              color: "#1565c0",
              border: `1.5px solid ${alpha("#1565c0", 0.5)}`,
            }}
          >
            <LocalParkingIcon sx={{ fontSize: 16 }} />
          </Avatar>
        </Tooltip>
      </Stack>

      {/* Top: next 10 days */}
      <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 4, overflow: "visible" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          10 הימים הקרובים
        </Typography>
        {next10Q.isLoading ? (
          <Skeleton variant="rectangular" height={110} />
        ) : (
          <Box
            sx={{
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: { xs: "minmax(108px, 1fr)", sm: "minmax(120px, 1fr)", md: "1fr" },
              gap: 1,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              direction: "rtl",
              pb: 1,
              mx: { xs: -0.5, sm: 0 },
              scrollSnapType: { xs: "x proximity", md: "none" },
            }}
          >
            {next10.map(({ iso, weekday, dayNum, monthShort }) => {
              const isToday = iso === today;
              const list = next10ByDay.get(iso) ?? [];
              const bdays = birthdaysByIso.get(iso) ?? [];
              const pk = parkingByIso.get(iso) ?? [];
              // count distinct employees per status
              const byStatus = new Map<StatusKey, Set<string>>();
              for (const s of list) {
                if (!byStatus.has(s.status)) byStatus.set(s.status, new Set());
                byStatus.get(s.status)!.add(s.employeeId);
              }
              return (
                <Box
                  key={iso}
                  onClick={() => setOpenDay(iso)}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 2,
                    p: { xs: 0.75, sm: 1.25 },
                    minHeight: { xs: 100, sm: 120 },
                    scrollSnapAlign: "start",
                    border: "1px solid",
                    borderColor: isToday ? "primary.main" : "divider",
                    background: isToday
                      ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.22)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
                      : "transparent",
                    boxShadow: isToday ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}` : "none",
                    transition: "transform 140ms, box-shadow 180ms, border-color 180ms",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: 4,
                      borderColor: "primary.light",
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">
                      {HEBREW_WEEKDAYS[weekday]} · {monthShort}
                    </Typography>
                    {isToday && (
                      <Chip size="small" label={t("today")} color="primary" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </Stack>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      lineHeight: 1,
                      mt: 0.5,
                      fontSize: { xs: "1.5rem", sm: "2.125rem" },
                      color: isToday ? "primary.main" : "text.primary",
                    }}
                  >
                    {dayNum}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    {STATUS_ORDER.map((k) => {
                      const n = byStatus.get(k)?.size ?? 0;
                      if (n === 0) return null;
                      const meta = statusMeta[k];
                      return (
                        <Tooltip key={k} title={`${t(meta.presenceI18nKey)}: ${n}`} arrow>
                          <Stack
                            direction="row"
                            spacing={0.25}
                            alignItems="center"
                            sx={{
                              px: 0.5,
                              py: 0.125,
                              borderRadius: 1,
                              bgcolor: alpha(meta.color, 0.14),
                              color: meta.color,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <meta.Icon sx={{ fontSize: 13 }} />
                            <span>{n}</span>
                          </Stack>
                        </Tooltip>
                      );
                    })}
                  </Stack>
                  {bdays.length > 0 && (
                    <Tooltip title={bdays.map((b) => b.fullName).join(" · ")} arrow>
                      <Stack
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{
                          mt: 0.75,
                          px: 0.75,
                          py: 0.35,
                          borderRadius: 1.5,
                          background: `linear-gradient(90deg, ${alpha("#ec407a", 0.2)} 0%, ${alpha("#ab47bc", 0.15)} 100%)`,
                          border: `1px solid ${alpha("#e91e63", 0.38)}`,
                          maxWidth: "100%",
                        }}
                      >
                        <CakeOutlinedIcon sx={{ fontSize: 16, color: "#c2185b", flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ fontWeight: 800, color: "#880e4f", fontSize: 10.5, minWidth: 0 }}
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
                        alignItems="center"
                        sx={{
                          mt: 0.5,
                          px: 0.75,
                          py: 0.35,
                          borderRadius: 1.5,
                          background: `linear-gradient(90deg, ${alpha("#1565c0", 0.18)} 0%, ${alpha("#0277bd", 0.12)} 100%)`,
                          border: `1px solid ${alpha("#1565c0", 0.35)}`,
                          maxWidth: "100%",
                        }}
                      >
                        <LocalParkingIcon sx={{ fontSize: 16, color: "#0d47a1", flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ fontWeight: 800, color: "#0d47a1", fontSize: 10.5, minWidth: 0 }}
                        >
                          {pk.length === 1
                            ? `${pk[0].spotLabel} → ${pk[0].guestName}`
                            : `${pk.length} ${t("calendarParkingStrip")}`}
                        </Typography>
                      </Stack>
                    </Tooltip>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Card>

      {/* Bottom: full month grid */}
      <Card sx={{ p: { xs: 1, md: 2 }, overflow: "visible" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              חודש מלא
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {monthLabel}
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
          <Box sx={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Box sx={{ minWidth: { xs: 300, sm: "auto" } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: { xs: 0.35, sm: 0.5 },
                mb: 1,
                direction: "rtl",
              }}
            >
              {HEBREW_WEEKDAYS.map((d) => (
                <Typography
                  key={d}
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  sx={{ fontWeight: 700, fontSize: { xs: "0.65rem", sm: "0.75rem" } }}
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
                  gap: { xs: 0.35, sm: 0.5 },
                  mb: 0.5,
                  direction: "rtl",
                }}
              >
                {row.map((cell, ci) => {
                  if (!cell) return <Box key={ci} />;
                  const isToday = cell.iso === today;
                  const dayNum = Number(cell.iso.slice(8));
                  const totals: { k: StatusKey; n: number }[] = STATUS_ORDER.map((k) => ({
                    k,
                    n: cell.agg ? (cell.agg[k] as number) : 0,
                  })).filter((x) => x.n > 0);
                  const mbdays = birthdaysByIso.get(cell.iso) ?? [];
                  const pkdays = parkingByIso.get(cell.iso) ?? [];
                  const accentBirthday = mbdays.length > 0;
                  const accentParking = pkdays.length > 0 && !accentBirthday;

                  return (
                    <Box
                      key={ci}
                      onClick={() => setOpenDay(cell.iso)}
                      sx={{
                        cursor: "pointer",
                        borderRadius: { xs: 1, sm: 2 },
                        p: { xs: 0.35, sm: 1 },
                        minHeight: { xs: 56, sm: 90 },
                        minWidth: 0,
                        border: "1px solid",
                        borderColor: isToday
                          ? "primary.main"
                          : accentBirthday
                            ? alpha("#e91e63", 0.55)
                            : accentParking
                              ? alpha("#1565c0", 0.5)
                              : "divider",
                        backgroundColor: isToday
                          ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.18 : 0.1)
                          : accentBirthday
                            ? alpha("#f48fb1", theme.palette.mode === "dark" ? 0.12 : 0.08)
                            : accentParking
                              ? alpha("#90caf9", theme.palette.mode === "dark" ? 0.12 : 0.08)
                              : "transparent",
                        boxShadow: isToday ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}` : "none",
                        transition: "transform 120ms, box-shadow 160ms",
                        "&:hover": {
                          transform: "translateY(-1px)",
                          boxShadow: 3,
                          borderColor: "primary.light",
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.25}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: isToday ? 800 : 600,
                            color: isToday ? "primary.main" : "text.primary",
                            fontSize: { xs: "0.8rem", sm: "0.875rem" },
                          }}
                        >
                          {dayNum}
                        </Typography>
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          {mbdays.length > 0 && (
                            <Tooltip title={mbdays.map((b) => b.fullName).join(" · ")} arrow>
                              <CakeOutlinedIcon sx={{ fontSize: { xs: 15, sm: 18 }, color: "#c2185b" }} />
                            </Tooltip>
                          )}
                          {pkdays.length > 0 && (
                            <Tooltip
                              title={pkdays.map((p) => `${p.spotLabel}: ${p.guestName} (${p.hoursLabel})`).join("\n")}
                              arrow
                            >
                              <LocalParkingIcon sx={{ fontSize: { xs: 15, sm: 18 }, color: "#0d47a1" }} />
                            </Tooltip>
                          )}
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, gap: 0.25 }}>
                        {totals.length === 0 ? (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: { xs: "0.65rem", sm: "0.75rem" } }}>
                            —
                          </Typography>
                        ) : (
                          totals.map(({ k, n }) => {
                            const meta = statusMeta[k];
                            return (
                              <Tooltip key={k} title={`${t(meta.presenceI18nKey)}: ${n}`} arrow>
                                <Stack
                                  direction="row"
                                  spacing={0.25}
                                  alignItems="center"
                                  sx={{
                                    px: { xs: 0.25, sm: 0.5 },
                                    py: 0.125,
                                    borderRadius: 1,
                                    bgcolor: alpha(meta.color, 0.14),
                                    color: meta.color,
                                    fontSize: { xs: 9, sm: 11 },
                                    fontWeight: 700,
                                    maxWidth: "100%",
                                  }}
                                >
                                  <meta.Icon sx={{ fontSize: { xs: 11, sm: 13 } }} />
                                  <span>{n}</span>
                                </Stack>
                              </Tooltip>
                            );
                          })
                        )}
                      </Stack>
                      {mbdays.length > 0 && (
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            display: "block",
                            mt: 0.35,
                            fontSize: { xs: "0.58rem", sm: "0.65rem" },
                            fontWeight: 700,
                            color: "#ad1457",
                          }}
                        >
                          {mbdays.length === 1 ? mbdays[0].fullName : `🎈 ${mbdays.length}`}
                        </Typography>
                      )}
                      {pkdays.length > 0 && (
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            display: "block",
                            mt: 0.25,
                            fontSize: { xs: "0.58rem", sm: "0.65rem" },
                            fontWeight: 700,
                            color: "#0d47a1",
                          }}
                        >
                          {pkdays.length === 1
                            ? `${pkdays[0].spotLabel} → ${pkdays[0].guestName}`
                            : `🅿 ${pkdays.length}`}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
            </Box>
          </Box>
        )}
      </Card>

      <Box
        sx={(th) => ({
          mt: 4,
          pt: 3,
          pb: 2,
          px: 2,
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
            display: "inline-block",
            fontStyle: "italic",
            letterSpacing: "0.045em",
            fontWeight: 600,
            fontSize: { xs: "1.02rem", sm: "1.22rem" },
            lineHeight: 1.5,
            color: alpha(th.palette.text.primary, th.palette.mode === "dark" ? 0.88 : 0.7),
          })}
        >
          {t("taglineCalendar")}
        </Typography>
      </Box>

      <DayEditorDialog
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
        onChanged={async () => {
          await qc.invalidateQueries({ queryKey: ["calendar-day"] });
          await qc.invalidateQueries({ queryKey: ["calendar-next10"] });
          await qc.invalidateQueries({ queryKey: ["calendar-month"] });
          await qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
          await qc.invalidateQueries({ queryKey: ["parking-reservations"] });
        }}
      />
    </Box>
  );
}

function DayEditorDialog({
  open,
  date,
  fullScreen,
  items,
  loading,
  employeeMap,
  employees,
  canWrite,
  birthdaysOnDate,
  parkingOnDate,
  onClose,
  onChanged,
}: {
  open: boolean;
  date: string | null;
  fullScreen?: boolean;
  items: Schedule[];
  loading: boolean;
  employeeMap: Map<string, Employee>;
  employees: Employee[];
  canWrite: boolean;
  birthdaysOnDate: { employeeId: string; fullName: string }[];
  parkingOnDate: { spotLabel: string; guestName: string; hoursLabel: string }[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editor, setEditor] = useState<{
    id?: string;
    employeeId: string;
    status: StatusKey;
    hours: string;
    note: string;
  } | null>(null);

  const weekdayLabel = useMemo(() => {
    if (!date) return "";
    const d = new Date(date);
    return HEBREW_WEEKDAYS_FULL[d.getDay()];
  }, [date]);

  const grouped = useMemo(() => {
    const out: Record<StatusKey, Schedule[]> = { office: [], home: [], vacation: [], sick: [], off: [] };
    for (const s of items) out[s.status].push(s);
    return out;
  }, [items]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editor || !date) return;
      const payload: Record<string, unknown> = {
        workDate: date,
        status: editor.status,
        note: editor.note || undefined,
      };
      if (editor.hours.trim() !== "") {
        const h = Number(editor.hours);
        if (!Number.isNaN(h)) payload.hours = h;
      }
      if (editor.id) {
        await api.put(`/api/schedules/${editor.id}`, payload);
      } else {
        payload.employeeId = editor.employeeId;
        await api.post("/api/schedules", payload);
      }
    },
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      setEditor(null);
      await onChanged();
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/schedules/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      await onChanged();
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  function startAdd() {
    setEditor({ employeeId: "", status: "office", hours: "", note: "" });
  }
  function startEdit(s: Schedule) {
    setEditor({
      id: s.id,
      employeeId: s.employeeId,
      status: s.status,
      hours: s.hours != null ? String(s.hours) : "",
      note: s.note ?? "",
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={!!fullScreen}
      slotProps={{ paper: { sx: { m: fullScreen ? 0 : undefined } } }}
    >
      <DialogTitle sx={{ pr: fullScreen ? 6 : 2 }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={1}
          sx={{ flexWrap: "wrap", rowGap: 1 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
              <CalendarIcon />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                {date} · {weekdayLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {items.length} שיבוצים
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {canWrite && (
              <Tooltip title="הוספת שיבוץ" arrow>
                <IconButton color="primary" onClick={startAdd}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ overflowY: "auto" }}>
        {loading ? (
          <Skeleton height={120} />
        ) : (
          <Stack spacing={3}>
            {birthdaysOnDate.length > 0 && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  position: "relative",
                  overflow: "hidden",
                  background: `linear-gradient(125deg, ${alpha("#fce4ec", 0.95)} 0%, ${alpha("#f3e5f5", 0.9)} 45%, ${alpha("#e1f5fe", 0.85)} 100%)`,
                  border: `1px solid ${alpha("#e91e63", 0.35)}`,
                  boxShadow: `0 8px 24px -12px ${alpha("#c2185b", 0.35)}`,
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    top: 6,
                    insetInlineEnd: 10,
                    width: 14,
                    height: 18,
                    borderRadius: "50% 50% 45% 45%",
                    bgcolor: alpha("#e91e63", 0.35),
                  }}
                />
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    bottom: 8,
                    insetInlineStart: 12,
                    width: 10,
                    height: 14,
                    borderRadius: "50% 50% 45% 45%",
                    bgcolor: alpha("#9c27b0", 0.3),
                  }}
                />
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ position: "relative", zIndex: 1 }}>
                  <Avatar sx={{ bgcolor: alpha("#e91e63", 0.2), color: "#ad1457" }}>
                    <CakeOutlinedIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: "#880e4f" }}>
                      {t("birthdayDayEditorBanner")}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap sx={{ mt: 1 }}>
                      {birthdaysOnDate.map((b) => (
                        <Chip
                          key={b.employeeId}
                          label={b.fullName}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            bgcolor: alpha("#fff", 0.85),
                            border: `1px solid ${alpha("#e91e63", 0.25)}`,
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            )}
            {parkingOnDate.length > 0 && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha("#1565c0", 0.35)}`,
                  background: `linear-gradient(125deg, ${alpha("#e3f2fd", 0.95)} 0%, ${alpha("#e8eaf6", 0.9)} 100%)`,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Avatar sx={{ bgcolor: alpha("#1565c0", 0.2), color: "#0d47a1" }}>
                    <LocalParkingIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: "#0d47a1" }}>
                      {t("calendarParkingDayBanner")}
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                      {parkingOnDate.map((p, i) => (
                        <Typography key={i} variant="body2" sx={{ fontWeight: 600 }}>
                          {p.spotLabel} → {p.guestName}{" "}
                          <Typography component="span" variant="caption" color="text.secondary">
                            ({p.hoursLabel})
                          </Typography>
                        </Typography>
                      ))}
                    </Stack>
                    <Button component={RouterLink} to="/parking" size="small" sx={{ mt: 1.5 }} variant="outlined">
                      {t("parking")}
                    </Button>
                  </Box>
                </Stack>
              </Box>
            )}
            {STATUS_ORDER.map((k) => {
              const list = grouped[k];
              if (list.length === 0) return null;
              const meta = statusMeta[k];
              return (
                <Box key={k}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Avatar sx={{ bgcolor: alpha(meta.color, 0.16), color: meta.color, width: 30, height: 30 }}>
                      <meta.Icon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: meta.color }}>
                      {t(meta.i18nKey)}
                    </Typography>
                    <Chip size="small" label={list.length} sx={{ bgcolor: alpha(meta.color, 0.16), color: meta.color }} />
                  </Stack>
                  <Stack spacing={1}>
                    {list.map((s) => {
                      const name = employeeMap.get(s.employeeId)?.fullName ?? `…${s.employeeId.slice(-6)}`;
                      return (
                        <Stack
                          key={s.id}
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "stretch", sm: "center" }}
                          sx={{
                            px: { xs: 1, sm: 1.5 },
                            py: 0.75,
                            borderRadius: 1.5,
                            bgcolor: alpha(meta.color, theme.palette.mode === "dark" ? 0.14 : 0.07),
                            borderInlineStart: `4px solid ${meta.color}`,
                          }}
                        >
                          <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 600, wordBreak: "break-word" }}>
                            {name}
                          </Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            {s.hours != null && (
                              <Chip size="small" label={`${s.hours} שעות`} variant="outlined" />
                            )}
                            {s.note && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  flex: { xs: "1 1 100%", sm: "0 1 auto" },
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: { xs: "normal", sm: "nowrap" },
                                  maxWidth: { sm: 200 },
                                }}
                              >
                                {s.note}
                              </Typography>
                            )}
                            {canWrite && (
                              <Stack direction="row" spacing={0.5} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
                              <Tooltip title={t("edit")} arrow>
                                <IconButton size="small" color="primary" onClick={() => startEdit(s)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t("delete")} arrow>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => {
                                    if (confirm(`למחוק את השיבוץ של ${name}?`)) deleteMut.mutate(s.id);
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                            )}
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              );
            })}
            {items.length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
                {t("noData")}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* Inline editor */}
      <Dialog open={!!editor} onClose={() => setEditor(null)} fullWidth maxWidth="sm" fullScreen={isXs}>
        <DialogTitle>
          {editor?.id ? "עריכת שיבוץ" : "שיבוץ חדש"} — {date}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="עובד"
              value={editor?.employeeId ?? ""}
              disabled={!!editor?.id}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, employeeId: e.target.value } : cur))}
            >
              {employees.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.fullName} {emp.jobTitle ? `· ${emp.jobTitle}` : ""}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="סטטוס"
              value={editor?.status ?? "office"}
              onChange={(e) =>
                setEditor((cur) => (cur ? { ...cur, status: e.target.value as StatusKey } : cur))
              }
            >
              {STATUS_ORDER.map((s) => {
                const meta = statusMeta[s];
                return (
                  <MenuItem key={s} value={s}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <meta.Icon sx={{ color: meta.color, fontSize: 18 }} />
                      <span>{t(s)}</span>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>
            <TextField
              label="שעות (אופציונלי) — השאר ריק ליום מלא"
              type="number"
              inputProps={{ min: 0, max: 24, step: 0.5 }}
              value={editor?.hours ?? ""}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, hours: e.target.value } : cur))}
              helperText="לעובד במשרד חלק מהיום וחלק מהבית — שמור שיבוץ נוסף לאותו תאריך"
            />
            <TextField
              label="הערה"
              multiline
              minRows={2}
              value={editor?.note ?? ""}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, note: e.target.value } : cur))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditor(null)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={!editor?.employeeId || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      <Divider />
    </Dialog>
  );
}
