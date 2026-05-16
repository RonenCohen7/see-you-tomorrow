import {
  Alert,
  Avatar,
  Box,
  Button,
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
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/AddCircle";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import api from "../services/api";
import type { Employee, Schedule } from "../types/models";
import type { MeetingBookingPublic } from "../types/meeting";
import type { ParkingReservationPublic, ParkingSpotPublic } from "../utils/parkingSmartAlerts";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { compareSchedulesForCalendarRoster } from "../utils/calendarRosterSort";
import { useAuth } from "../store/authContext";

export function CalendarDayEditorDialog({
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
  parkingSpots,
  parkingDayReservations,
  meetingsOnDate,
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
  parkingSpots?: ParkingSpotPublic[];
  parkingDayReservations?: ParkingReservationPublic[];
  meetingsOnDate: MeetingBookingPublic[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const rosterSortLocale = appIntlLocale(locale);
  const theme = useTheme();
  const { user } = useAuth();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editor, setEditor] = useState<{
    id?: string;
    employeeId: string;
    status: StatusKey;
    hours: string;
    note: string;
  } | null>(null);

  const weekdayLabelsFull = useMemo(() => {
    const raw = t("calendarWeekdayLettersFull", { returnObjects: true });
    return Array.isArray(raw) ? raw.map(String) : [];
  }, [t]);

  const weekdayLabel = useMemo(() => {
    if (!date) return "";
    const d = new Date(date);
    return weekdayLabelsFull[d.getDay()] ?? "";
  }, [date, weekdayLabelsFull]);

  const grouped = useMemo(() => {
    const out: Record<StatusKey, Schedule[]> = { office: [], home: [], vacation: [], sick: [], off: [] };
    for (const s of items) out[s.status].push(s);
    const cmp = (a: Schedule, b: Schedule) =>
      compareSchedulesForCalendarRoster(a, b, employeeMap, rosterSortLocale);
    for (const k of STATUS_ORDER) {
      out[k].sort(cmp);
    }
    return out;
  }, [items, employeeMap, rosterSortLocale]);

  /** Short allocation label per employee (spot id/label); only when reservation or matched fixed spot. */
  const parkingSpotSummaryByEmployeeId = useMemo(() => {
    const spots = parkingSpots ?? [];
    const resList = parkingDayReservations ?? [];
    const spotById = new Map(spots.map((s) => [s.id, s]));
    const byEmp = new Map<string, Set<string>>();

    const addLine = (employeeId: string, line: string) => {
      if (!employeeId || !line) return;
      let set = byEmp.get(employeeId);
      if (!set) {
        set = new Set<string>();
        byEmp.set(employeeId, set);
      }
      set.add(line);
    };

    for (const r of resList) {
      const spot = spotById.get(r.spotId);
      const spotLabel = spot?.label?.trim() || t("parkingColSpot");
      const partial = r.hourStart != null || r.hourEnd != null;
      const line = partial ? `${spotLabel} · ${r.hourStart ?? "—"}–${r.hourEnd ?? "—"}` : spotLabel;
      addLine(r.employeeId, line);
    }

    for (const sched of items) {
      if (sched.status !== "office") continue;
      for (const spot of spots) {
        if (!spot.isActive) continue;
        if (spot.assignedEmployeeId !== sched.employeeId) continue;
        if (sched.locationId && spot.locationId !== sched.locationId) continue;
        const label = spot.label?.trim() || t("parkingColSpot");
        addLine(sched.employeeId, label);
      }
    }

    const m = new Map<string, string[]>();
    for (const [employeeId, set] of byEmp) {
      m.set(employeeId, [...set]);
    }
    return m;
  }, [items, parkingSpots, parkingDayReservations, t]);

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
                {t("calEditorAssignmentsCount", { count: items.length })}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {canWrite && (
              <Tooltip title={t("newShift")} arrow>
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
                    {canWrite ? (
                      <Button component={RouterLink} to="/parking" size="small" sx={{ mt: 1.5 }} variant="outlined">
                        {t("parking")}
                      </Button>
                    ) : null}
                  </Box>
                </Stack>
              </Box>
            )}
            {meetingsOnDate.length > 0 && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha("#00695c", 0.35)}`,
                  background: `linear-gradient(125deg, ${alpha("#e0f2f1", 0.95)} 0%, ${alpha("#eceff1", 0.9)} 100%)`,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Avatar sx={{ bgcolor: alpha("#00695c", 0.2), color: "#004d40" }}>
                    <MeetingRoomIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: "#004d40" }}>
                      {t("calendarMeetingDayBanner")}
                    </Typography>
                    <Stack spacing={1.25} sx={{ mt: 1 }}>
                      {meetingsOnDate.map((m) => {
                        const hours =
                          m.hourStart != null || m.hourEnd != null
                            ? `${m.hourStart ?? "—"}–${m.hourEnd ?? "—"}`
                            : t("meetingFullDay");
                        const canEditMeeting = user?.role === "admin" || user?.id === m.organizerId;
                        return (
                          <Box key={m.id}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {m.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {m.roomName} · {m.locationName}
                              {m.floor ? ` · ${t("meetingFieldFloor")} ${m.floor}` : ""}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" lang="en" sx={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                              {date} · {hours}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t("meetingColOrganizer")}: {m.organizerName}
                            </Typography>
                            {m.invitees?.length ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                {t("meetingInviteesHeading")}: {m.invitees.map((i) => i.fullName).join(", ")}
                              </Typography>
                            ) : null}
                            {(m.materials ?? []).length > 0 ? (
                              <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                                <Typography variant="caption" fontWeight={700}>
                                  {t("meetingCalendarMaterials")}
                                </Typography>
                                {(m.materials ?? []).map((mat, idx) =>
                                  mat.kind === "link" ? (
                                    <Typography key={`lnk-${idx}`} variant="caption">
                                      <Box component="a" href={mat.url} target="_blank" rel="noopener noreferrer">
                                        {mat.label?.trim() || mat.url}
                                      </Box>
                                    </Typography>
                                  ) : (
                                    <Typography key={`fil-${idx}`} variant="caption">
                                      <Box component="a" href={mat.dataUrl} download={mat.fileName}>
                                        {mat.fileName}
                                      </Box>
                                    </Typography>
                                  )
                                )}
                              </Stack>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                              {canEditMeeting ? (
                                <Button component={RouterLink} to={`/meeting-rooms?edit=${encodeURIComponent(m.id)}`} size="small" variant="outlined">
                                  {t("meetingEdit")}
                                </Button>
                              ) : null}
                              <Button component={RouterLink} to={`/meeting-rooms?date=${encodeURIComponent(date ?? "")}`} size="small" variant="text">
                                {t("meetingGoBookRoom")}
                              </Button>
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
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
                      const parkingAllocated =
                        k === "office"
                          ? (parkingSpotSummaryByEmployeeId.get(s.employeeId) ?? []).join(" · ")
                          : "";

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
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
                              {name}
                            </Typography>
                            {k === "office" && parkingAllocated ? (
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="flex-start"
                                sx={{ mt: 0.35, flexWrap: "wrap", rowGap: 0.35 }}
                              >
                                <LocalParkingIcon sx={{ fontSize: 15, mt: "1px", color: "warning.main", flexShrink: 0 }} />
                                <Typography
                                  variant="caption"
                                  sx={{ color: "warning.dark", fontWeight: 700 }}
                                  component="span"
                                >
                                  {parkingAllocated}
                                </Typography>
                              </Stack>
                            ) : null}
                          </Box>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                            {s.source === "ai" && (
                              <Chip
                                size="small"
                                label={t("scheduleSourceAi")}
                                color="secondary"
                                variant="outlined"
                                sx={{ height: 22, fontWeight: 700 }}
                              />
                            )}
                            {s.hours != null && (
                              <Chip size="small" label={t("calEditorHoursLabel", { hours: s.hours })} variant="outlined" />
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
                                      if (confirm(t("calEditorConfirmDelete", { name }))) deleteMut.mutate(s.id);
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

      <Dialog open={!!editor} onClose={() => setEditor(null)} fullWidth maxWidth="sm" fullScreen={isXs}>
        <DialogTitle>
          {editor?.id ? t("schedulesEditShift") : t("newShift")} — {date}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label={t("deptBulkEmployeeColumn")}
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
              label={t("notificationsStatusLabel")}
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
              label={t("deptBulkHoursOptional")}
              type="number"
              inputProps={{ min: 0, max: 24, step: 0.5 }}
              value={editor?.hours ?? ""}
              onChange={(e) => setEditor((cur) => (cur ? { ...cur, hours: e.target.value } : cur))}
              helperText={t("calEditorPartialDayHelper")}
            />
            <TextField
              label={t("notificationsNoteLabel")}
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
