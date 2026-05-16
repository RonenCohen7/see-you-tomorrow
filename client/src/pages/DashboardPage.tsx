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
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import api from "../services/api";
import type { Schedule } from "../types/models";
import { todayIsoLocal } from "../utils/date";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../store/authContext";
import { useEffect, useMemo, useState } from "react";
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

type NavTile = {
  to: string;
  i18nKey: string;
  descriptionKey: string;
  Icon: React.ElementType;
  color: string;
  adminOnly?: boolean;
  /** מנהל מחלקה / אדמין — מוסתר מעובד רגיל */
  managerOrAdminOnly?: boolean;
};

const tiles: NavTile[] = [
  { to: "/calendar", i18nKey: "calendar", Icon: CalendarIcon, descriptionKey: "dashTileCalendarDesc", color: "#0ea5e9" },
  {
    to: "/schedules",
    i18nKey: "schedules",
    Icon: SchedulesIcon,
    descriptionKey: "dashTileSchedulesDesc",
    color: "#f97316",
    managerOrAdminOnly: true,
  },
  { to: "/employees", i18nKey: "employees", Icon: EmployeesIcon, descriptionKey: "dashTileEmployeesDesc", color: "#8b5cf6", adminOnly: true },
  { to: "/departments", i18nKey: "departments", Icon: DepartmentsIcon, descriptionKey: "dashTileDepartmentsDesc", color: "#22c55e", adminOnly: true },
  { to: "/locations", i18nKey: "locations", Icon: LocationsIcon, descriptionKey: "dashTileLocationsDesc", color: "#ef4444", adminOnly: true },
  { to: "/ai", i18nKey: "ai", Icon: AIIcon, descriptionKey: "dashTileAiDesc", color: "#ec4899", managerOrAdminOnly: true },
  { to: "/notifications", i18nKey: "notifications", Icon: NotificationsListIcon, descriptionKey: "dashTileNotificationsDesc", color: "#eab308" },
];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
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

  const visibleTiles = tiles.filter((t) => {
    if (t.adminOnly && user?.role !== "admin") return false;
    if (t.managerOrAdminOnly && user?.role === "employee") return false;
    return true;
  });

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
        <DashboardIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.2rem", sm: "1.65rem" } }}>
          {t("dashboard")}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {t("lastUpdated")}: {new Date(lastUpd).toLocaleString(intlTag)}
      </Typography>
      <Typography
        component="p"
        lang="en"
        sx={(th) => ({
          direction: "ltr",
          textAlign: { xs: "center", sm: "start" },
          fontSize: { xs: "0.95rem", sm: "1.1rem" },
          fontWeight: 600,
          fontStyle: "italic",
          letterSpacing: "0.04em",
          lineHeight: 1.45,
          color: alpha(th.palette.primary.main, th.palette.mode === "dark" ? 0.88 : 0.72),
          mb: 1.5,
          maxWidth: 520,
        })}
      >
        {t("taglineDashboard")}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: { xs: 1, sm: 1.25 },
          mb: 2,
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(min(100%, 88px), 1fr))",
            sm: "repeat(auto-fill, minmax(min(100%, 96px), 1fr))",
            md: "repeat(auto-fill, minmax(min(100%, 100px), 1fr))",
            lg: "repeat(auto-fill, minmax(min(100%, 112px), 1fr))",
            xl: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
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

      <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
        {t("goTo")}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1, sm: 1.25 },
          mb: 2,
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(min(100%, 88px), 1fr))",
            sm: "repeat(auto-fill, minmax(min(100%, 96px), 1fr))",
            md: "repeat(auto-fill, minmax(min(100%, 100px), 1fr))",
            lg: "repeat(auto-fill, minmax(min(100%, 110px), 1fr))",
            xl: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
          },
        }}
      >
        {visibleTiles.map(({ to, i18nKey, Icon, descriptionKey, color }) => (
          <Tooltip key={to} title={`${t(i18nKey)} — ${t(descriptionKey)}`} arrow placement="top">
            <Card className="syt-lift" sx={(th) => ({ bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.36 : 0.56), backdropFilter: "saturate(150%) blur(10px)", WebkitBackdropFilter: "saturate(150%) blur(10px)" })}>
              <CardActionArea component={RouterLink} to={to} sx={{ p: { xs: 1.25, sm: 1.5 } }}>
                <Stack alignItems="center" spacing={0.75}>
                  <Avatar
                    sx={{
                      bgcolor: alpha(color, 0.14),
                      color,
                      width: { xs: 44, sm: 50 },
                      height: { xs: 44, sm: 50 },
                      border: `2px solid ${alpha(color, 0.35)}`,
                    }}
                  >
                    <Icon fontSize="medium" />
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

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
          {t("today")} · {today}
        </Typography>
        {qDay.isLoading ? (
          <Skeleton variant="rectangular" height={120} />
        ) : items.length === 0 ? (
          <Card sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">{t("noData")}</Typography>
          </Card>
        ) : (
          <>
            <Card
              sx={(th) => ({
                p: { xs: 1.25, sm: 1.5 },
                flexShrink: 0,
                bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.4 : 0.62),
                backdropFilter: "saturate(150%) blur(12px)",
                WebkitBackdropFilter: "saturate(150%) blur(12px)",
              })}
            >
              <PresenceLegend stats={stats} total={items.length} />
              {isAdminOrManager && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
                    {t("atOffice")} ({stats.office})
                  </Typography>
                  {stats.office === 0 ? (
                    <Typography variant="caption" color="text.disabled">
                      {t("dashNoOfficeToday")}
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
                        .slice(0, 12)
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
                      {stats.office > 12 && (
                        <Chip size="small" variant="outlined" label={`+${stats.office - 12}`} sx={{ flexShrink: 0 }} />
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Card>
            <Box sx={{ flex: 1, minHeight: { xs: 24, sm: 40 } }} aria-hidden />
            <Box
              sx={{
                width: "100vw",
                maxWidth: "100vw",
                marginInline: "calc(50% - 50vw)",
                boxSizing: "border-box",
                flexShrink: 0,
                pt: 1,
              }}
            >
              <PresenceRibbon stats={stats} total={items.length} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function PresenceRibbon({ stats, total }: { stats: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        minHeight: { xs: 14, sm: 18 },
        borderRadius: 0,
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
  );
}

function PresenceLegend({ stats, total }: { stats: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <Stack
      direction="row"
      spacing={1.25}
      flexWrap="wrap"
      useFlexGap
      sx={{ rowGap: 0.75, columnGap: 1.5, alignItems: "center" }}
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
        sx={(th) => ({
          borderTop: `3px solid ${color}`,
          position: "relative",
          overflow: "visible",
          minWidth: 0,
          bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.38 : 0.58),
          backdropFilter: "saturate(150%) blur(10px)",
          WebkitBackdropFilter: "saturate(150%) blur(10px)",
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `radial-gradient(circle at top right, ${alpha(color, 0.18)}, transparent 60%)`,
            pointerEvents: "none",
          },
        })}
      >
        <CardContent sx={{ position: "relative", zIndex: 1, minWidth: 0, px: { xs: 0.75, sm: 1.25 }, py: { xs: 1, sm: 1.25 } }}>
          <Stack direction="column" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: alpha(color, 0.18), color, width: { xs: 38, sm: 42 }, height: { xs: 38, sm: 42 }, flexShrink: 0 }}>
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
                  fontSize: { xs: "1.05rem", sm: "clamp(1.05rem, 2vw, 1.65rem)" },
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
