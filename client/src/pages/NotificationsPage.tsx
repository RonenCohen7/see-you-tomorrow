import EventNoteIcon from "@mui/icons-material/EventNote";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PersonIcon from "@mui/icons-material/Person";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import type { NotificationItem } from "../types/models";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import { useAuth } from "../store/authContext";
import { scheduleStatusPresentation } from "../utils/scheduleStatusUi";

function isReadForUser(n: NotificationItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (n.readBy ?? []).some((r) => r.userId === userId);
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();

  const orgMetaQ = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () =>
      (
        await api.get<{
          customScheduleStatuses: { id: string; labelHe: string; labelEn?: string }[];
        }>("/api/schedules/org-settings")
      ).data,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ items: NotificationItem[]; total: number }>("/api/notifications?limit=80")).data,
  });

  const readMut = useMutation({
    mutationFn: async (id: string) => api.put(`/api/notifications/${id}/read`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      await qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });

  const items = q.data?.items ?? [];

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
        <NotificationsActiveIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
          {t("notifications")}
        </Typography>
        <Chip size="small" label={`${items.length} ${t("notificationsTimelineCount")}`} variant="outlined" />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720, lineHeight: 1.65 }}>
        {t("notificationsPageIntro")}
      </Typography>

      {q.isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="rounded" height={100} />
          <Skeleton variant="rounded" height={100} />
        </Stack>
      ) : items.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary">{t("notificationsEmpty")}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={0}>
          {items.map((n, index) => {
            const read = isReadForUser(n, user?.id);
            const sc = n.scheduleContext;
            const mc = n.meetingContext;
            const orgCustoms = orgMetaQ.data?.customScheduleStatuses ?? [];
            const statusPres =
              sc?.status && sc.status.trim() !== "" ? scheduleStatusPresentation(sc.status, t, orgCustoms) : null;
            const statusChipLabel = (sc?.statusDisplayHe?.trim() || statusPres?.label || sc?.status || "").trim();
            const isLast = index === items.length - 1;
            return (
              <Box
                key={n.id}
                sx={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: { xs: 1.5, sm: 2 },
                  pb: isLast ? 0 : 2.5,
                }}
              >
                {/* milestone rail */}
                <Box sx={{ position: "relative", width: 24, flexShrink: 0 }}>
                  <Box
                    sx={{
                      position: "absolute",
                      insetInlineStart: "50%",
                      top: 10,
                      width: 12,
                      height: 12,
                      marginInlineStart: -6,
                      borderRadius: "50%",
                      bgcolor: read ? alpha(theme.palette.text.secondary, 0.35) : "primary.main",
                      border: `2px solid ${theme.palette.background.paper}`,
                      boxShadow: `0 0 0 2px ${alpha(read ? theme.palette.text.secondary : theme.palette.primary.main, 0.35)}`,
                      zIndex: 1,
                    }}
                  />
                  {!isLast ? (
                    <Box
                      sx={{
                        position: "absolute",
                        insetInlineStart: "50%",
                        top: 22,
                        bottom: -8,
                        width: 2,
                        marginInlineStart: -1,
                        bgcolor: "divider",
                      }}
                    />
                  ) : null}
                </Box>

                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    borderColor: read ? "divider" : alpha(theme.palette.primary.main, 0.35),
                    bgcolor: read ? undefined : alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.06 : 0.04),
                  }}
                >
                  <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} flexWrap="wrap">
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {new Date(n.createdAt).toLocaleString(intlTag, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Typography>
                        {read ? (
                          <Chip size="small" label={t("notificationsReadBadge")} variant="outlined" />
                        ) : (
                          <Chip size="small" color="primary" label={t("notificationsUnreadBadge")} />
                        )}
                      </Stack>
                      {!read ? (
                        <Button size="small" variant="contained" onClick={() => readMut.mutate(n.id)} disabled={readMut.isPending}>
                          {t("notificationsMarkRead")}
                        </Button>
                      ) : null}
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={800} sx={{ mt: 1, wordBreak: "break-word" }}>
                      {n.title}
                    </Typography>

                    {sc && n.type === "schedule_update" ? (
                      <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <PersonIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                          <Typography variant="body2" fontWeight={700}>
                            {t("notificationsForEmployee")}
                          </Typography>
                          <Typography variant="body2">{sc.employeeName}</Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <EventNoteIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                          <Typography variant="body2" fontWeight={700}>
                            {sc.workDateEnd && sc.workDateEnd !== sc.workDate
                              ? t("notificationsWorkDateRange")
                              : t("notificationsWorkDate")}
                          </Typography>
                          <Typography variant="body2" component="span" lang="en" sx={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                            {sc.workDateEnd && sc.workDateEnd !== sc.workDate
                              ? `${sc.workDate} – ${sc.workDateEnd}`
                              : sc.workDate}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          {statusPres ? (
                            <statusPres.Icon sx={{ fontSize: 20, color: statusPres.color }} />
                          ) : null}
                          <Typography variant="body2" fontWeight={700}>
                            {t("notificationsStatusLabel")}
                          </Typography>
                          <Chip
                            size="small"
                            label={statusChipLabel || sc.status}
                            sx={{
                              fontWeight: 700,
                              color: statusPres?.color ?? theme.palette.text.secondary,
                              borderColor: statusPres?.color ? alpha(statusPres.color, 0.5) : undefined,
                            }}
                            variant="outlined"
                          />
                        </Stack>

                        {sc.updatedByName ? (
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <EditCalendarIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                            <Typography variant="body2" fontWeight={700}>
                              {t("notificationsUpdatedBy")}
                            </Typography>
                            <Typography variant="body2">{sc.updatedByName}</Typography>
                          </Stack>
                        ) : null}

                        {sc.note ? (
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                            <strong>{t("notificationsNoteLabel")}:</strong> {sc.note}
                          </Typography>
                        ) : null}

                        <Divider sx={{ my: 0.5 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                          {n.message}
                        </Typography>

                        {user?.role === "admin" || user?.role === "manager" ? (
                          <Button
                            component={RouterLink}
                            to="/schedules"
                            size="small"
                            variant="outlined"
                            sx={{ alignSelf: "flex-start", mt: 0.5 }}
                          >
                            {t("notificationsGoSchedules")}
                          </Button>
                        ) : null}
                      </Stack>
                    ) : mc && n.type === "meeting_invite" ? (
                      <Stack spacing={1.25} sx={{ mt: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <MeetingRoomIcon sx={{ fontSize: 20, color: "#00695c" }} />
                          <Typography variant="body2" fontWeight={700}>
                            {mc.roomName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            · {mc.locationName}
                          </Typography>
                          {mc.floor ? (
                            <Chip size="small" variant="outlined" label={`${t("notificationsMeetingFloor")}: ${mc.floor}`} />
                          ) : null}
                          {mc.isUpdate ? (
                            <Chip size="small" color="secondary" variant="outlined" label={t("notificationsMeetingUpdated")} />
                          ) : null}
                        </Stack>

                        <Typography variant="body2" fontWeight={700}>
                          {mc.title}
                        </Typography>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <EventNoteIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                          <Typography variant="body2" fontWeight={700}>
                            {t("notificationsWorkDate")}
                          </Typography>
                          <Typography variant="body2" component="span" lang="en" sx={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                            {mc.workDate}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            ·{" "}
                            {mc.hourStart != null || mc.hourEnd != null
                              ? `${mc.hourStart ?? "—"}–${mc.hourEnd ?? "—"}`
                              : t("meetingFullDay")}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <PersonIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                          <Typography variant="body2" fontWeight={700}>
                            {t("notificationsMeetingOrganizer")}
                          </Typography>
                          <Typography variant="body2">{mc.organizerName}</Typography>
                        </Stack>

                        <Divider sx={{ my: 0.5 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                          {n.message}
                        </Typography>

                        <Button
                          component={RouterLink}
                          to={
                            user?.id === mc.organizerId || user?.role === "admin"
                              ? `/meeting-rooms?edit=${encodeURIComponent(mc.bookingId)}`
                              : "/meeting-rooms"
                          }
                          size="small"
                          variant="outlined"
                          sx={{ alignSelf: "flex-start", mt: 0.5 }}
                        >
                          {t("notificationsGoMeetingRooms")}
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {n.message}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
