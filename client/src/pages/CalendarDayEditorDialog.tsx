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
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/AddCircle";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import api from "../services/api";
import type { Employee, Schedule } from "../types/models";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { HEBREW_WEEKDAYS_FULL } from "./calendarConstants";

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
