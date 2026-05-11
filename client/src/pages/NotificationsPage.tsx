import EventNoteIcon from "@mui/icons-material/EventNote";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PersonIcon from "@mui/icons-material/Person";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
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
import { useAuth } from "../store/authContext";
import { statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";

function isReadForUser(n: NotificationItem, userId: string | undefined): boolean {
  if (!userId) return false;
  return (n.readBy ?? []).some((r) => r.userId === userId);
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();

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
            const statusKey = (sc?.status ?? "") as StatusKey;
            const sm = statusMeta[statusKey];
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
                          {new Date(n.createdAt).toLocaleString("he-IL", {
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
                          {sm ? <sm.Icon sx={{ fontSize: 20, color: sm.color }} /> : null}
                          <Typography variant="body2" fontWeight={700}>
                            {t("notificationsStatusLabel")}
                          </Typography>
                          {sm ? (
                            <Chip
                              size="small"
                              label={t(sm.i18nKey)}
                              sx={{ fontWeight: 700, color: sm.color, borderColor: alpha(sm.color, 0.5) }}
                              variant="outlined"
                            />
                          ) : (
                            <Chip size="small" label={sc.status} variant="outlined" />
                          )}
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

                        <Button component={RouterLink} to="/schedules" size="small" variant="outlined" sx={{ alignSelf: "flex-start", mt: 0.5 }}>
                          {t("notificationsGoSchedules")}
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
