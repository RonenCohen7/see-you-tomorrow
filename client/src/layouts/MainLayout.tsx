import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CircleIcon from "@mui/icons-material/Circle";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import CalendarIcon from "@mui/icons-material/CalendarMonth";
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

const WIDTH = 264;

const adminOnlyNav = ["/employees", "/departments", "/locations"];

type NavItem = {
  to: string;
  key: string;
  Icon: React.ComponentType<{ fontSize?: "small" | "medium" | "large" }>;
};

const allPaths: NavItem[] = [
  { to: "/dashboard", key: "dashboard", Icon: DashboardIcon },
  { to: "/calendar", key: "calendar", Icon: CalendarIcon },
  { to: "/employees", key: "employees", Icon: EmployeesIcon },
  { to: "/departments", key: "departments", Icon: DepartmentsIcon },
  { to: "/locations", key: "locations", Icon: LocationsIcon },
  { to: "/schedules", key: "schedules", Icon: SchedulesIcon },
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const role = useRole();
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket(user?.id);
  const [newUserSnackbarOpen, setNewUserSnackbarOpen] = React.useState(false);
  const clearedRegisterState = React.useRef(false);

  React.useEffect(() => {
    const st = loc.state as { justRegistered?: boolean } | null | undefined;
    if (st?.justRegistered && !clearedRegisterState.current) {
      clearedRegisterState.current = true;
      setNewUserSnackbarOpen(true);
      navigate({ pathname: loc.pathname, search: loc.search, hash: loc.hash }, { replace: true, state: {} });
    }
  }, [loc.state, loc.pathname, loc.search, loc.hash, navigate]);

  const { data: unread } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => (await api.get<{ count: number }>("/api/notifications/unread-count")).data.count,
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const nav = allPaths.filter((p) => {
    if (adminOnlyNav.includes(p.to)) return role === "admin";
    if (p.to === "/reports") return role === "admin" || role === "manager";
    return true;
  });

  const initials = (user?.fullName ?? "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  const drawer = (
    <Box sx={{ width: WIDTH, pt: 2, height: "100%", display: "flex", flexDirection: "column" }}>
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
      <List sx={{ flexGrow: 1 }}>
        {nav.map(({ to, key, Icon }) => {
          const selected = loc.pathname === to;
          return (
            <Tooltip key={to} title={t(key)} placement="left" arrow disableInteractive>
              <ListItemButton
                component={RouterLink}
                to={to}
                selected={selected}
                onClick={() => mobile && setMobileOpen(false)}
              >
                <ListItemIcon sx={{ minWidth: 38, color: selected ? "primary.main" : "text.secondary" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t(key)}
                  primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                />
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 1 }}>
        <Tooltip title={t("logout")} placement="left" arrow disableInteractive>
          <ListItemButton onClick={() => void logout()}>
            <ListItemIcon sx={{ minWidth: 38, color: "text.secondary" }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={t("logout")} />
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", minWidth: 0, width: "100%", overflowX: "hidden" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (th) => th.zIndex.drawer + 1,
          pt: "env(safe-area-inset-top, 0px)",
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.5, sm: 1 },
            px: { xs: 0.5, sm: 2 },
            minHeight: { xs: 52, sm: 64 },
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
            sx={{ flexShrink: 0, maxWidth: { xs: "min(52vw, 220px)", sm: "none" } }}
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
                  maxWidth: { xs: 100, sm: 220, md: 280 },
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
            <Tooltip title={t("notifications")} arrow>
              <IconButton color="inherit" component={RouterLink} to="/notifications" size="medium">
                <Badge badgeContent={unread ?? 0} color="secondary">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" }, [`& .MuiDrawer-paper`]: { width: WIDTH } }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          [`& .MuiDrawer-paper`]: { width: WIDTH, boxSizing: "border-box", borderInlineEnd: "1px solid", borderColor: "divider" },
        }}
        open
      >
        {drawer}
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: { xs: "100%", md: `calc(100% - ${WIDTH}px)` },
          maxWidth: "100%",
          p: { xs: 1.5, sm: 2.5, md: 3.5, lg: 4, xl: 5 },
          mt: {
            xs: `calc(52px + env(safe-area-inset-top, 0px))`,
            sm: `calc(64px + env(safe-area-inset-top, 0px))`,
          },
          pt: 0,
          pb: { xs: `max(12px, env(safe-area-inset-bottom, 0px))`, md: 3 },
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            width: "100%",
            minWidth: 0,
            maxWidth: { xs: "100%", xl: "min(100%, 1680px)" },
            mx: "auto",
            boxSizing: "border-box",
          }}
        >
          <Outlet />
        </Box>
      </Box>
      {user ? (
        <Box
          sx={{
            position: "fixed",
            zIndex: (th) => th.zIndex.tooltip + 1,
            bottom: { xs: 88, sm: 24 },
            right: 16,
            left: "auto",
            display: "flex",
            flexDirection: "column-reverse",
            alignItems: "flex-end",
            gap: 1.25,
            pb: "env(safe-area-inset-bottom, 0px)",
            pr: "env(safe-area-inset-right, 0px)",
            pointerEvents: "none",
            "& > *": { pointerEvents: "auto" },
          }}
        >
          <AiInsightFab socket={socket} />
          <BirthdayFab socket={socket} />
        </Box>
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
    </Box>
  );
}
