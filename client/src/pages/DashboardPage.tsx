import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import api from "../services/api";
import type { Schedule } from "../types/models";
import { todayIsoLocal } from "../utils/date";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../store/authContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { Employee } from "../types/models";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import EmployeesIcon from "@mui/icons-material/Groups";
import DepartmentsIcon from "@mui/icons-material/Apartment";
import LocationsIcon from "@mui/icons-material/Place";
import SchedulesIcon from "@mui/icons-material/EventNote";
import AIIcon from "@mui/icons-material/AutoAwesome";
import NotificationsListIcon from "@mui/icons-material/NotificationsActive";

const DASH_REFRESH = "dashboard:refresh";

/** Mixkit — team with laptops / meeting (no eating); override with VITE_DASHBOARD_BG_VIDEO_URL. */
const DEFAULT_DASHBOARD_BG_VIDEO = "https://assets.mixkit.co/videos/6095/6095-720.mp4";

function DashboardBackgroundVideo() {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduceMotion) return;
    void v.play().catch(() => {});
  }, [reduceMotion]);

  const custom = (import.meta.env.VITE_DASHBOARD_BG_VIDEO_URL as string | undefined)?.trim();
  const bg = theme.palette.background.default;

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        borderRadius: 2,
      }}
    >
      {!reduceMotion ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        >
          {custom ? <source src={custom} type="video/mp4" /> : null}
          <source src={DEFAULT_DASHBOARD_BG_VIDEO} type="video/mp4" />
        </video>
      ) : (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.dark, 0.1)} 100%)`,
          }}
        />
      )}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(180deg, ${alpha(bg, 0.88)} 0%, ${alpha(bg, 0.78)} 50%, ${alpha(bg, 0.84)} 100%)`
              : `linear-gradient(180deg, ${alpha(bg, 0.84)} 0%, ${alpha(bg, 0.72)} 50%, ${alpha(bg, 0.8)} 100%)`,
        }}
      />
    </Box>
  );
}

type NavTile = {
  to: string;
  i18nKey: string;
  Icon: React.ElementType;
  description: string;
  color: string;
  adminOnly?: boolean;
};

const tiles: NavTile[] = [
  { to: "/calendar", i18nKey: "calendar", Icon: CalendarIcon, description: "תצוגת יומן חודשית", color: "#0ea5e9" },
  { to: "/schedules", i18nKey: "schedules", Icon: SchedulesIcon, description: "ניהול ועריכת משמרות", color: "#f97316" },
  { to: "/employees", i18nKey: "employees", Icon: EmployeesIcon, description: "רשימת עובדים", color: "#8b5cf6", adminOnly: true },
  { to: "/departments", i18nKey: "departments", Icon: DepartmentsIcon, description: "ניהול מחלקות", color: "#22c55e", adminOnly: true },
  { to: "/locations", i18nKey: "locations", Icon: LocationsIcon, description: "ניהול מיקומים", color: "#ef4444", adminOnly: true },
  { to: "/ai", i18nKey: "ai", Icon: AIIcon, description: "המלצות חכמות", color: "#ec4899" },
  { to: "/notifications", i18nKey: "notifications", Icon: NotificationsListIcon, description: "התראות והודעות", color: "#eab308" },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { socket } = useSocket(user?.id);
  const [lastUpd, setLastUpd] = useState(() => new Date().toISOString());

  const today = todayIsoLocal();
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  const qDay = useQuery({
    queryKey: ["schedules-day", today],
    queryFn: async () => (await api.get<{ items: Schedule[] }>(`/api/schedules/day/${today}`)).data,
  });

  const qEmp = useQuery({
    queryKey: ["employees-count"],
    queryFn: async () => (await api.get<{ total: number }>("/api/employees?page=1&limit=1")).data,
    enabled: isAdminOrManager,
  });

  const qEmpList = useQuery({
    queryKey: ["employees-names"],
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
    enabled: isAdminOrManager,
  });

  const employeeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of qEmpList.data ?? []) m.set(e.id, e.fullName);
    return m;
  }, [qEmpList.data]);

  useEffect(() => {
    if (!socket) return;
    const onRefresh = () => {
      setLastUpd(new Date().toISOString());
      void qDay.refetch();
    };
    socket.on(DASH_REFRESH, onRefresh);
    return () => {
      socket.off(DASH_REFRESH, onRefresh);
    };
  }, [socket, qDay]);

  const items = qDay.data?.items ?? [];
  const stats = useMemo(
    () =>
      STATUS_ORDER.reduce<Record<string, number>>((acc, k) => {
        acc[k] = items.filter((i) => i.status === k).length;
        return acc;
      }, {}),
    [items]
  );

  const visibleTiles = tiles.filter((t) => !t.adminOnly || user?.role === "admin");

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        isolation: "isolate",
      }}
    >
      <DashboardBackgroundVideo />
      <Box sx={{ position: "relative", zIndex: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
        <DashboardIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
          {t("dashboard")}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t("lastUpdated")}: {new Date(lastUpd).toLocaleString("he-IL")}
      </Typography>
      <Typography
        component="p"
        lang="en"
        sx={(th) => ({
          direction: "ltr",
          textAlign: { xs: "center", sm: "start" },
          fontSize: { xs: "1.02rem", sm: "1.2rem" },
          fontWeight: 600,
          fontStyle: "italic",
          letterSpacing: "0.04em",
          lineHeight: 1.45,
          color: alpha(th.palette.primary.main, th.palette.mode === "dark" ? 0.88 : 0.72),
          mb: 3,
          maxWidth: 520,
        })}
      >
        {t("taglineDashboard")}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          mb: 4,
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
            sm: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
            md: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
          },
        }}
      >
        {isAdminOrManager && (
          <StatCard
            label={t("employees")}
            value={qEmp.data?.total}
            loading={qEmp.isLoading}
            color="#8b5cf6"
            Icon={EmployeesIcon}
          />
        )}
        {STATUS_ORDER.map((k) => {
          const meta = statusMeta[k];
          return (
            <StatCard
              key={k}
              label={t(meta.presenceI18nKey)}
              value={stats[k]}
              loading={qDay.isLoading}
              color={meta.color}
              Icon={meta.Icon}
            />
          );
        })}
      </Box>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t("goTo")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
            sm: "repeat(auto-fill, minmax(min(100%, 148px), 1fr))",
            md: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
            lg: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
          },
        }}
      >
        {visibleTiles.map(({ to, i18nKey, Icon, description, color }) => (
          <Tooltip key={to} title={`${t(i18nKey)} — ${description}`} arrow placement="top">
            <Card className="syt-lift">
              <CardActionArea component={RouterLink} to={to} sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Stack alignItems="center" spacing={1}>
                  <Avatar
                    sx={{
                      bgcolor: alpha(color, 0.14),
                      color,
                      width: { xs: 48, sm: 56 },
                      height: { xs: 48, sm: 56 },
                      border: `2px solid ${alpha(color, 0.35)}`,
                    }}
                  >
                    <Icon fontSize="large" />
                  </Avatar>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                    sx={{ color, textAlign: "center", lineHeight: 1.2, wordBreak: "break-word", px: 0.5 }}
                  >
                    {t(i18nKey)}
                  </Typography>
                </Stack>
              </CardActionArea>
            </Card>
          </Tooltip>
        ))}
      </Box>

      <Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
        {t("today")} · {today}
      </Typography>
      {qDay.isLoading ? (
        <Skeleton variant="rectangular" height={140} />
      ) : items.length === 0 ? (
        <Card sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">{t("noData")}</Typography>
        </Card>
      ) : (
        <Card sx={{ p: { xs: 1.5, sm: 2 }, overflow: "visible" }}>
          <PresenceDistribution stats={stats} total={items.length} />
          {isAdminOrManager && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                {t("atOffice")} ({stats.office})
              </Typography>
              {stats.office === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  אין עובדים במשרד היום
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    alignItems: "flex-start",
                    alignContent: "flex-start",
                  }}
                >
                  {items
                    .filter((s) => s.status === "office")
                    .slice(0, 16)
                    .map((s) => {
                      const name = employeeNameById.get(s.employeeId);
                      const meta = statusMeta.office;
                      return (
                        <Chip
                          key={s.id}
                          icon={<meta.Icon fontSize="small" />}
                          label={name ?? `…${s.employeeId.slice(-4)}`}
                          size="small"
                          sx={{
                            maxWidth: "100%",
                            height: "auto",
                            py: 0.5,
                            alignItems: "flex-start",
                            bgcolor: alpha(meta.color, 0.12),
                            color: meta.color,
                            border: `1px solid ${alpha(meta.color, 0.4)}`,
                            "& .MuiChip-icon": { color: meta.color, marginTop: "2px" },
                            "& .MuiChip-label": {
                              whiteSpace: "normal",
                              overflow: "visible",
                              textOverflow: "clip",
                              display: "block",
                              lineHeight: 1.25,
                              py: 0.25,
                            },
                          }}
                        />
                      );
                    })}
                  {stats.office > 16 && (
                    <Chip size="small" variant="outlined" label={`+${stats.office - 16}`} sx={{ flexShrink: 0 }} />
                  )}
                </Box>
              )}
            </Box>
          )}
        </Card>
      )}
      </Box>
    </Box>
  );
}

function PresenceDistribution({ stats, total }: { stats: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          minHeight: 14,
          borderRadius: 7,
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
        }}
      >
        {STATUS_ORDER.map((k) => {
          const v = stats[k] ?? 0;
          if (v === 0) return null;
          const pct = (v / total) * 100;
          const meta = statusMeta[k];
          return (
            <Tooltip key={k} title={`${v} · ${Math.round(pct)}%`} arrow>
              <Box
                sx={{
                  flexGrow: v,
                  flexBasis: 0,
                  minWidth: v / total < 0.08 ? 6 : 0,
                  bgcolor: meta.color,
                  transition: "flex-grow 240ms",
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
      <Stack
        direction="row"
        spacing={2}
        flexWrap="wrap"
        useFlexGap
        sx={{ mt: 1.5, rowGap: 1, columnGap: 2, alignItems: "center" }}
      >
        {STATUS_ORDER.map((k) => {
          const v = stats[k] ?? 0;
          const meta = statusMeta[k];
          const pct = total > 0 ? Math.round((v / total) * 100) : 0;
          const dim = v === 0;
          return (
            <Stack
              key={k}
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{ opacity: dim ? 0.45 : 1 }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: meta.color }} />
              <meta.Icon sx={{ color: meta.color, fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {v}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {pct}%
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}


function StatCard({
  label,
  value,
  loading,
  color,
  Icon,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  color: string;
  Icon: React.ElementType;
}) {
  return (
    <Tooltip title={label} arrow placement="top">
      <Card
        className="syt-lift"
        sx={{
          borderTop: `3px solid ${color}`,
          position: "relative",
          overflow: "visible",
          minWidth: 0,
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `radial-gradient(circle at top right, ${alpha(color, 0.18)}, transparent 60%)`,
            pointerEvents: "none",
          },
        }}
      >
        <CardContent sx={{ position: "relative", zIndex: 1, minWidth: 0, px: { xs: 1, sm: 2 } }}>
          <Stack direction="column" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: alpha(color, 0.18), color, width: 44, height: 44, flexShrink: 0 }}>
              <Icon fontSize="medium" />
            </Avatar>
            {loading ? (
              <Skeleton width={60} height={40} />
            ) : (
              <Typography
                variant="h5"
                sx={{
                  color,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  textAlign: "center",
                  width: "100%",
                  minWidth: 0,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: { xs: "1.25rem", sm: "clamp(1.15rem, 2.5vw, 2rem)" },
                }}
              >
                {value ?? "—"}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Tooltip>
  );
}
