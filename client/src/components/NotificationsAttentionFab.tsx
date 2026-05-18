import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Zoom,
  alpha,
  useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { SOCKET_EVENTS_CLIENT } from "../constants/socketEvents";
import api from "../services/api";
import { useAuth } from "../store/authContext";
import type { NotificationItem } from "../types/models";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import { isNotificationReadForUser } from "../utils/notificationRead";

const PREVIEW_LIMIT = 8;

function contextOneLiner(n: NotificationItem): string | null {
  const sc = n.scheduleContext;
  const mc = n.meetingContext;
  if (sc && n.type === "schedule_update") {
    const parts = [sc.employeeName, sc.workDate].filter((x): x is string => Boolean(x?.trim()));
    return parts.length ? parts.join(" · ") : null;
  }
  if (mc && n.type === "meeting_invite") {
    const parts = [mc.roomName, mc.workDate].filter((x): x is string => Boolean(x?.trim()));
    return parts.length ? parts.join(" · ") : null;
  }
  return null;
}

type Props = { socket: Socket | null };

export function NotificationsAttentionFab({ socket }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const { user } = useAuth();
  const qc = useQueryClient();
  const loc = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: unreadCount = 0, isLoading: unreadLoading } = useQuery({
    queryKey: ["unread"],
    queryFn: async () => (await api.get<{ count: number }>("/api/notifications/unread-count")).data.count,
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });

  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (await api.get<{ items: NotificationItem[]; total: number }>("/api/notifications?limit=80")).data,
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const invalidateNotifs = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["unread"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);

  useEffect(() => {
    if (!socket) return;
    const bump = () => invalidateNotifs();
    socket.on(SOCKET_EVENTS_CLIENT.dashboardRefresh, bump);
    socket.on(SOCKET_EVENTS_CLIENT.notificationNew, bump);
    return () => {
      socket.off(SOCKET_EVENTS_CLIENT.dashboardRefresh, bump);
      socket.off(SOCKET_EVENTS_CLIENT.notificationNew, bump);
    };
  }, [socket, invalidateNotifs]);

  const unreadItems = useMemo(() => {
    const items = notifQ.data?.items ?? [];
    return items.filter((n) => !isNotificationReadForUser(n, user?.id));
  }, [notifQ.data?.items, user?.id]);

  const preview = useMemo(() => unreadItems.slice(0, PREVIEW_LIMIT), [unreadItems]);
  const moreCount = Math.max(0, unreadItems.length - preview.length);

  const readMut = useMutation({
    mutationFn: async (id: string) => api.put(`/api/notifications/${id}/read`),
    onSuccess: invalidateNotifs,
  });

  if (!user || loc.pathname === "/notifications") return null;

  /** Wait for unread count once so we avoid flashing — same source as toolbar badge. */
  if (unreadLoading) return null;
  if (unreadCount <= 0) return null;

  const isRtl = theme.direction === "rtl";

  const listLoading = notifQ.isPending && !notifQ.data;

  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytNotifPulse": {
            "0%, 100%": { boxShadow: `0 10px 28px ${alpha("#f57c00", 0.22)}` },
            "50%": { boxShadow: `0 14px 36px ${alpha("#fb8c00", 0.38)}` },
          },
        }}
      />
      <Zoom in>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Tooltip title={t("notificationsFabTooltip")} placement={isRtl ? "left" : "right"} arrow>
            <Box
              component="button"
              type="button"
              onClick={() => setDialogOpen(true)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 1.1,
                border: `1px solid ${alpha("#fb8c00", 0.45)}`,
                cursor: "pointer",
                borderRadius: 999,
                color: theme.palette.mode === "dark" ? "#ffe0b2" : "#5d3100",
                position: "relative",
                overflow: "hidden",
                background:
                  theme.palette.mode === "dark"
                    ? `linear-gradient(135deg, ${alpha("#e65100", 0.45)} 0%, ${alpha("#ef6c00", 0.35)} 100%)`
                    : `linear-gradient(135deg, #fff3e0 0%, #ffe0b2 40%, #ffcc80 72%, #fff8e1 100%)`,
                boxShadow: `0 10px 28px ${alpha("#f57c00", 0.22)}`,
                animation: "sytNotifPulse 2.8s ease-in-out infinite",
                transition: "transform 0.2s ease",
                "&:hover": {
                  transform: "translateY(-3px)",
                },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `radial-gradient(circle at 25% 30%, ${alpha("#fff", 0.65)} 0%, transparent 50%)`,
                  opacity: theme.palette.mode === "dark" ? 0.12 : 0.9,
                }}
              />
              <NotificationsActiveIcon
                sx={{ fontSize: 22, color: "#e65100", position: "relative", zIndex: 1 }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 0.15,
                  maxWidth: 220,
                  lineHeight: 1.25,
                  textAlign: "start",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {unreadCount === 1
                  ? t("notificationsFabLabelOne")
                  : t("notificationsFabLabelMany", { count: unreadCount })}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Zoom>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ pr: 5, pt: 2.5, pb: 1 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
            <Stack spacing={0.5}>
              <Typography variant="h6" fontWeight={800} sx={{ color: "#e65100" }}>
                {t("notificationsFabDialogTitle")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("notificationsFabDialogSubtitle")}
              </Typography>
            </Stack>
            <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ mt: -0.5 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 1 }}>
          {listLoading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
              <CircularProgress size={36} aria-label={t("loading")} />
            </Stack>
          ) : preview.length === 0 ? (
            <Alert severity="info">{t("notificationsFabOpenFullHint")}</Alert>
          ) : (
            <>
              <Stack spacing={2}>
                {preview.map((n) => {
                  const ctx = contextOneLiner(n);
                  const mc = n.meetingContext;
                  const schedulesLinkAllowed = user.role === "admin" || user.role === "manager";
                  return (
                    <Box
                      key={n.id}
                      sx={{
                        p: 1.75,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04),
                      }}
                    >
                      <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          {new Date(n.createdAt).toLocaleString(intlTag, { dateStyle: "medium", timeStyle: "short" })}
                        </Typography>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ wordBreak: "break-word" }}>
                          {n.title}
                        </Typography>
                        {ctx ? (
                          <Typography variant="body2" color="primary" fontWeight={600}>
                            {ctx}
                          </Typography>
                        ) : null}
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {n.message}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.25 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => readMut.mutate(n.id)}
                            disabled={readMut.isPending}
                          >
                            {t("notificationsMarkRead")}
                          </Button>
                          {schedulesLinkAllowed && n.type === "schedule_update" ? (
                            <Button
                              component={RouterLink}
                              to="/schedules"
                              size="small"
                              variant="outlined"
                              onClick={() => setDialogOpen(false)}
                            >
                              {t("notificationsGoSchedules")}
                            </Button>
                          ) : null}
                          {mc && n.type === "meeting_invite" ? (
                            <Button
                              component={RouterLink}
                              to={
                                user.id === mc.organizerId || user.role === "admin"
                                  ? `/meeting-rooms?edit=${encodeURIComponent(mc.bookingId)}`
                                  : "/meeting-rooms"
                              }
                              size="small"
                              variant="outlined"
                              onClick={() => setDialogOpen(false)}
                            >
                              {t("notificationsGoMeetingRooms")}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
              {moreCount > 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {t("notificationsFabMoreCount", { count: moreCount })}
                </Alert>
              ) : null}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button component={RouterLink} to="/notifications" variant="contained" color="warning" onClick={() => setDialogOpen(false)}>
            {t("notificationsFabOpenAll")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
