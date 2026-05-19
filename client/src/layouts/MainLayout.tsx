import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CircleIcon from "@mui/icons-material/Circle";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import EmployeesIcon from "@mui/icons-material/Groups";
import DepartmentsIcon from "@mui/icons-material/Apartment";
import LocationsIcon from "@mui/icons-material/Place";
import SchedulesIcon from "@mui/icons-material/EventNote";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AIIcon from "@mui/icons-material/AutoAwesome";
import NotificationsListIcon from "@mui/icons-material/NotificationsActive";
import ProfileIcon from "@mui/icons-material/AccountCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import PolicyIcon from "@mui/icons-material/Policy";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import React from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { useAuth, useRole } from "../store/authContext";
import { useSocket } from "../hooks/useSocket";
import { AiInsightFab } from "../components/AiInsightFab";
import { BirthdayFab } from "../components/BirthdayFab";
import { NotificationsAttentionFab } from "../components/NotificationsAttentionFab";
import { VirtualAssistantWidget } from "../components/VirtualAssistantWidget";
import LanguageToggle from "../components/LanguageToggle";
import { ScreenHelpOverlay } from "../components/ScreenHelpOverlay";
import { SOCKET_EVENTS_CLIENT } from "../constants/socketEvents";

export type SystemBroadcastClientPayload = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  at: string;
};

const WIDTH = 264;
/** Permanent drawer width on typical laptops — frees horizontal space without tiny fonts */
const WIDTH_COMPACT = 220;

const adminOnlyNav = ["/employees", "/departments", "/locations", "/scheduling-rules"];
/** מנהל מחלקה / אדמין בלבד — לא מוצג למשתמש עם תפקיד עובד */
const managerAdminNav = ["/dashboard", "/schedules", "/parking", "/ai", "/notifications"];

type NavItem = {
  to: string;
  key: string;
  Icon: React.ComponentType<{ fontSize?: "small" | "medium" | "large" }>;
};

const allPaths: NavItem[] = [
  { to: "/dashboard", key: "dashboard", Icon: DashboardIcon },
  { to: "/calendar", key: "calendar", Icon: CalendarIcon },
  { to: "/meeting-rooms", key: "meetingRooms", Icon: MeetingRoomIcon },
  { to: "/preferences", key: "attendancePrefs", Icon: PlaylistAddCheckIcon },
  { to: "/employees", key: "employees", Icon: EmployeesIcon },
  { to: "/departments", key: "departments", Icon: DepartmentsIcon },
  { to: "/locations", key: "locations", Icon: LocationsIcon },
  { to: "/scheduling-rules", key: "schedulingRules", Icon: PolicyIcon },
  { to: "/schedules", key: "schedules", Icon: SchedulesIcon },
  { to: "/team-preferences", key: "teamAttendancePrefs", Icon: FactCheckIcon },
  { to: "/preference-ai-queue", key: "preferenceAiQueueNav", Icon: HourglassBottomIcon },
  { to: "/parking", key: "parking", Icon: LocalParkingIcon },
  { to: "/reports", key: "reports", Icon: AssessmentIcon },
  { to: "/ai", key: "ai", Icon: AIIcon },
  { to: "/notifications", key: "notifications", Icon: NotificationsListIcon },
  { to: "/profile", key: "profile", Icon: ProfileIcon },
  { to: "/settings", key: "settings", Icon: SettingsIcon },
];

export default function MainLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("md"));
  const compactDesktop = useMediaQuery("(max-width: 1399px)");
  const permanentDrawerW = !mobile && compactDesktop ? WIDTH_COMPACT : WIDTH;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [screenHelpOpen, setScreenHelpOpen] = React.useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const role = useRole();
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket(user?.id);
  /** עובד רגיל אינו רואה התראות, סוכן חכם או כפתורי FAB ניהוליים. */
  const isEmployee = role === "employee";
  const [newUserSnackbarOpen, setNewUserSnackbarOpen] = React.useState(false);
  const [systemSnack, setSystemSnack] = React.useState<SystemBroadcastClientPayload | null>(null);
  const clearedRegisterState = React.useRef(false);

  React.useEffect(() => {
    const st = loc.state as { justRegistered?: boolean } | null | undefined;
    if (st?.justRegistered && !clearedRegisterState.current) {
      clearedRegisterState.current = true;
      setNewUserSnackbarOpen(true);
      navigate({ pathname: loc.pathname, search: loc.search, hash: loc.hash }, { replace: true, state: {} });
    }
  }, [loc.state, loc.pathname, loc.search, loc.hash, navigate]);

  React.useEffect(() => {
    if (!socket) return;
    const onBroadcast = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const p = raw as Record<string, unknown>;
      if (
        typeof p.id !== "string" ||
        typeof p.title !== "string" ||
        typeof p.message !== "string" ||
        typeof p.at !== "string"
      ) {
        return;
      }
      const sev = p.severity;
      const severity =
        sev === "warning" || sev === "error" || sev === "info" ? sev : "info";
      setSystemSnack({
        id: p.id,
        title: p.title,
        message: p.message,
        severity,
        at: p.at,
      });
    };
    socket.on(SOCKET_EVENTS_CLIENT.systemBroadcast, onBroadcast);
    return () => {
      socket.off(SOCKET_EVENTS_CLIENT.systemBroadcast, onBroadcast);
    };
  }, [socket]);

  const { data: unread } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => (await api.get<{ count: number }>("/api/notifications/unread-count")).data.count,
    refetchInterval: 60_000,
    enabled: !!user && !isEmployee,
  });

  const nav = allPaths.filter((p) => {
    if (p.to === "/preferences") return role === "employee";
    if (p.to === "/preference-ai-queue") return role === "admin" || role === "manager";
    if (p.to === "/team-preferences") return role === "admin" || role === "manager";
    if (adminOnlyNav.includes(p.to)) return role === "admin";
    if (managerAdminNav.includes(p.to)) return role === "admin" || role === "manager";
    if (p.to === "/reports") return role === "admin" || role === "manager";
    return true;
  });

  const initials = (user?.fullName ?? "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  const drawerContent = (paperWidth: number) => (
    <Box dir={theme.direction} sx={{ width: paperWidth, pt: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, pb: 2 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontWeight: 700 }}>
          {initials || "S"}
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {t("appTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.fullName ?? ""}
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ mb: 1 }} />
      <List sx={{ flexGrow: 1 }} data-help-target="app-nav">
        {nav.map(({ to, key, Icon }) => {
          const selected = loc.pathname === to;
          return (
            <Tooltip key={to} title={t(key)} placement={theme.direction === "rtl" ? "left" : "right"} arrow disableInteractive>
              <ListItemButton
                component={RouterLink}
                to={to}
                selected={selected}
                onClick={() => mobile && setMobileOpen(false)}
                data-help-target={`nav-${key}`}
              >
                <ListItemIcon sx={{ color: selected ? "primary.main" : "text.secondary" }}>
                  <Icon fontSize="medium" />
                </ListItemIcon>
                <ListItemText
                  primary={t(key)}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                />
              </ListItemButton>
            </Tooltip>
          );
        })}
        {!isEmployee && (
          <Tooltip title={t("helpFabTooltip")} placement={theme.direction === "rtl" ? "left" : "right"} arrow disableInteractive>
            <ListItemButton
              onClick={() => {
                setScreenHelpOpen(true);
                if (mobile) setMobileOpen(false);
              }}
              aria-label={t("helpFabAria")}
            >
              <ListItemIcon sx={{ color: "text.secondary" }}>
                <Avatar alt="" src="/help-avatar.png" variant="rounded" sx={{ width: 28, height: 28, flexShrink: 0 }} />
              </ListItemIcon>
              <ListItemText primary={t("helpMenuItem")} primaryTypographyProps={{ fontWeight: 500 }} />
            </ListItemButton>
          </Tooltip>
        )}
      </List>
      <Divider />
      <Box sx={{ p: 1 }}>
        <Tooltip title={t("logout")} placement={theme.direction === "rtl" ? "left" : "right"} arrow disableInteractive>
          <ListItemButton onClick={() => void logout()}>
            <ListItemIcon sx={{ color: "text.secondary" }}>
              <LogoutIcon fontSize="medium" />
            </ListItemIcon>
            <ListItemText primary={t("logout")} />
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        minHeight: "100dvh",
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <AppBar
        position="fixed"
        sx={{
          zIndex: (th) => th.zIndex.drawer + 1,
          pt: "env(safe-area-inset-top, 0px)",
          left: 0,
          right: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <Toolbar
          data-help-target="app-toolbar"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.5, sm: 0.75, md: 1 },
            px: { xs: 0.5, sm: 1, md: 1.5 },
            minHeight: { xs: 52, sm: 64 },
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>

          {/* left cluster (RTL) — kept narrow & balanced against the right cluster so the centered title stays centered */}
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, minWidth: 0 }} />

          {/* centered logo + title */}
          <Stack
            direction="row"
            spacing={{ xs: 1.25, sm: 4 }}
            alignItems="center"
            justifyContent="center"
            sx={{ flexShrink: 0, minWidth: 0, maxWidth: { xs: "min(46vw, 200px)", sm: "min(52vw, 240px)", md: "none" } }}
          >
            <Avatar
              alt={t("appTitle")}
              src="/logo.png"
              sx={{
                width: { xs: 36, sm: 44 },
                height: { xs: 36, sm: 44 },
                border: "2px solid rgba(255,255,255,0.6)",
                boxShadow: "0 4px 16px -4px rgba(0,0,0,0.25)",
                flexShrink: 0,
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                fontSize: { xs: "0.8rem", sm: "1.25rem" },
                lineHeight: 1.15,
                textAlign: "center",
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {t("appTitle")}
            </Typography>
          </Stack>

          {/* right cluster (RTL): greeting first in DOM = outer edge with flex-end */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: { xs: 0.25, sm: 1 },
              minWidth: 0,
            }}
          >
            {user?.fullName ? (
              <Typography
                variant="body2"
                component="span"
                sx={{
                  fontWeight: 600,
                  color: "inherit",
                  maxWidth: { xs: 72, sm: 160, md: 200, lg: 260 },
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                  verticalAlign: "middle",
                }}
                title={user.fullName}
              >
                {t("helloUser", { name: user.fullName })}
              </Typography>
            ) : null}
            <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1 }}>
              <CircleIcon sx={{ fontSize: 12, color: connected ? "success.light" : "error.light" }} />
              <Typography variant="caption">{connected ? t("liveConnected") : t("liveDisconnected")}</Typography>
            </Box>
            <LanguageToggle />
            {!isEmployee && (
              <Tooltip title={t("notifications")} arrow>
                <IconButton color="inherit" component={RouterLink} to="/notifications" size="medium">
                  <Badge badgeContent={unread ?? 0} color="secondary">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          direction: "ltr",
          flex: "1 1 0",
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          overflow: "hidden",
          gap: { xs: 0, md: 3, xl: 4 },
        }}
      >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" }, [`& .MuiDrawer-paper`]: { width: WIDTH, boxSizing: "border-box" } }}
      >
        {drawerContent(WIDTH)}
      </Drawer>
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          display: { xs: "none", md: "block" },
          width: permanentDrawerW,
          flexShrink: 0,
          alignSelf: "stretch",
          [`& .MuiDrawer-paper`]: {
            position: "relative",
            height: "100%",
            width: permanentDrawerW,
            boxSizing: "border-box",
            borderInlineEnd: "1px solid",
            borderColor: "divider",
          },
        }}
        open
      >
        {drawerContent(permanentDrawerW)}
      </Drawer>
      <Box
        component="main"
        data-help-target="app-main"
        sx={{
          direction: theme.direction,
          flex: "1 1 0%",
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          px: { xs: 1.5, sm: 1.75, md: 2.5, lg: 3, xl: 3.5 },
          pb: { xs: `max(8px, env(safe-area-inset-bottom, 0px))`, md: 2 },
          mt: {
            xs: `calc(52px + env(safe-area-inset-top, 0px))`,
            sm: `calc(64px + env(safe-area-inset-top, 0px))`,
          },
          pt: { xs: 0.75, sm: 1 },
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            mx: "auto",
            boxSizing: "border-box",
          }}
        >
          <Outlet />
        </Box>
      </Box>
      </Box>
      {user && !isEmployee ? (
        <>
          <ScreenHelpOverlay
            open={screenHelpOpen}
            onClose={() => setScreenHelpOpen(false)}
            visibleNavKeys={nav.map((n) => n.key)}
          />
          <Box
            sx={{
              position: "fixed",
              zIndex: (th) => th.zIndex.tooltip + 1,
              bottom: { xs: 88, sm: 24 },
              ...(theme.direction === "rtl" ? { left: 16, right: "auto" } : { right: 16, left: "auto" }),
              display: "flex",
              flexDirection: "column-reverse",
              alignItems: "flex-end",
              gap: 1.25,
              pb: "env(safe-area-inset-bottom, 0px)",
              ...(theme.direction === "rtl"
                ? { pl: "env(safe-area-inset-left, 0px)" }
                : { pr: "env(safe-area-inset-right, 0px)" }),
              pointerEvents: "none",
              "& > *": { pointerEvents: "auto" },
            }}
          >
            <VirtualAssistantWidget
              role={role ?? "employee"}
              onOpenScreenHelp={() => setScreenHelpOpen(true)}
            />
            <AiInsightFab socket={socket} />
            <BirthdayFab socket={socket} />
            <NotificationsAttentionFab socket={socket} />
          </Box>
        </>
      ) : null}
      <Snackbar
        open={newUserSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setNewUserSnackbarOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: { xs: 7, sm: 8 } }}
      >
        <Alert onClose={() => setNewUserSnackbarOpen(false)} severity="success" variant="filled" sx={{ width: "100%" }}>
          {t("newUserRegisteredMessage")}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!systemSnack}
        autoHideDuration={systemSnack?.severity === "error" ? 14_000 : 10_000}
        onClose={() => setSystemSnack(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: { xs: 7, sm: 8 } }}
      >
        {systemSnack ? (
          <Alert
            onClose={() => setSystemSnack(null)}
            severity={systemSnack.severity}
            variant="filled"
            sx={{ width: "100%", maxWidth: { xs: "92vw", sm: 480 } }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {systemSnack.title}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
              {systemSnack.message}
            </Typography>
          </Alert>
        ) : (
          undefined
        )}
      </Snackbar>
    </Box>
  );
}
