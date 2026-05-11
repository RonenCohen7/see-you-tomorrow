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
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/AddCircle";
import SchedulesIcon from "@mui/icons-material/EventNote";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import api from "../services/api";
import type { Employee, Schedule } from "../types/models";
import { useTranslation } from "react-i18next";
import { useRole } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";

type FormState = {
  employeeId: string;
  workDate: string;
  status: StatusKey;
  hours: string;
  note: string;
};

const emptyForm: FormState = {
  employeeId: "",
  workDate: new Date().toISOString().slice(0, 10),
  status: "office",
  hours: "",
  note: "",
};

export default function ScheduleManagementPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const role = useRole();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const employeesQ = useQuery({
    queryKey: ["employees-all-for-schedule"],
    queryFn: async () => {
      const limit = 100;
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=${limit}`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return { items: all, total: all.length };
    },
  });

  const schedulesQ = useQuery({
    queryKey: ["schedules-all"],
    queryFn: async () => (await api.get<{ items: Schedule[] }>("/api/schedules")).data,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeesQ.data?.items ?? []) m.set(e.id, e);
    return m;
  }, [employeesQ.data?.items]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        workDate: form.workDate,
        status: form.status,
        note: form.note || undefined,
      };
      const h = form.hours.trim() === "" ? undefined : Number(form.hours);
      if (h !== undefined && !Number.isNaN(h)) payload.hours = h;
      if (editingId) {
        return api.put(`/api/schedules/${editingId}`, payload);
      }
      payload.employeeId = form.employeeId;
      return api.post("/api/schedules", payload);
    },
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/schedules/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const canWrite = role === "admin" || role === "manager";

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: Schedule) {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      workDate: row.workDate,
      status: row.status,
      hours: row.hours != null ? String(row.hours) : "",
      note: row.note ?? "",
    });
    setOpen(true);
  }

  const actionsColumn: GridColDef<Schedule> = {
    field: "actions",
    headerName: t("edit"),
    width: 120,
    sortable: false,
    filterable: false,
    align: "center",
    headerAlign: "center",
    renderCell: ({ row }) => (
      <Stack direction="row" spacing={0.25} sx={{ height: "100%", alignItems: "center" }}>
        <Tooltip title={t("edit")} arrow>
          <IconButton size="small" color="primary" onClick={() => openEdit(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("delete")} arrow>
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              if (confirm("למחוק שיבוץ זה?")) deleteMut.mutate(row.id);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    ),
  };

  const columns: GridColDef<Schedule>[] = [
    ...(canWrite ? [actionsColumn] : []),
    {
      field: "status",
      headerName: "סטטוס",
      width: 150,
      renderCell: ({ row }) => {
        const meta = statusMeta[row.status];
        return (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%" }}>
            <meta.Icon sx={{ color: meta.color, fontSize: 18 }} />
            <Typography variant="body2" fontWeight={700} sx={{ color: meta.color }}>
              {t(meta.i18nKey)}
            </Typography>
          </Stack>
        );
      },
    },
    {
      field: "employeeName",
      headerName: "עובד",
      flex: 1,
      minWidth: 200,
      cellClassName: "syt-cell-wrap",
      valueGetter: (_v, row) => employeeMap.get(row.employeeId)?.fullName ?? row.employeeId.slice(-6),
    },
    { field: "workDate", headerName: "תאריך", width: 130 },
    {
      field: "hours",
      headerName: "שעות",
      width: 90,
      align: "center",
      headerAlign: "center",
      valueFormatter: (v) => (v == null || v === "" ? "—" : `${v}h`),
    },
    { field: "note", headerName: "הערה", flex: 1, minWidth: 120, cellClassName: "syt-cell-wrap" },
  ];

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack
        direction="row"
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
          <SchedulesIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("schedules")}
          </Typography>
          <Chip size="small" label={`${schedulesQ.data?.items?.length ?? 0} ${t("total")}`} />
        </Stack>
        {canWrite && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
            {t("newShift")}
          </Button>
        )}
      </Stack>

      <Box
        sx={(th) => ({
          mb: 2,
          p: { xs: 1.5, sm: 2 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(th.palette.primary.main, th.palette.mode === "dark" ? 0.1 : 0.05),
          borderInlineStart: "4px solid",
          borderInlineStartColor: "primary.main",
        })}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: "text.primary" }}>
          {t("schedulesPageWhatFor")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.65 }}>
          {t("schedulesPageDescription")}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {STATUS_ORDER.map((k) => {
          const meta = statusMeta[k];
          return (
            <Chip
              key={k}
              size="small"
              icon={<meta.Icon fontSize="small" />}
              label={t(meta.i18nKey)}
              sx={{
                bgcolor: alpha(meta.color, 0.12),
                color: meta.color,
                border: `1px solid ${alpha(meta.color, 0.4)}`,
                "& .MuiChip-icon": { color: meta.color },
              }}
            />
          );
        })}
      </Stack>

      <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch", pb: 1 }}>
        <DataGrid
          autoHeight
          getRowHeight={() => "auto"}
          rows={schedulesQ.data?.items ?? []}
          getRowId={(r) => r.id}
          loading={schedulesQ.isLoading || employeesQ.isLoading}
          columns={columns}
          getRowClassName={({ row }) => `syt-row syt-row--${row.status}`}
          initialState={{
            sorting: { sortModel: [{ field: "workDate", sort: "desc" }] },
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{
            minWidth: { xs: 640, sm: "100%" },
            borderRadius: 2,
            "& .MuiDataGrid-cell": {
              borderColor: "divider",
              alignItems: "flex-start",
              py: 0.75,
            },
            "& .MuiDataGrid-cell.syt-cell-wrap": {
              whiteSpace: "normal",
              lineHeight: 1.35,
              wordBreak: "break-word",
            },
            "& .MuiDataGrid-cell:not(.syt-cell-wrap)": {
              alignItems: "center",
            },
            ...STATUS_ORDER.reduce((acc, k) => {
              const c = statusMeta[k].color;
              return {
                ...acc,
                [`& .syt-row--${k}`]: {
                  backgroundColor: (th: { palette: { mode: "light" | "dark" } }) =>
                    alpha(c, th.palette.mode === "dark" ? 0.14 : 0.08),
                  borderInlineStart: `4px solid ${c}`,
                  "&:hover": {
                    backgroundColor: (th: { palette: { mode: "light" | "dark" } }) =>
                      alpha(c, th.palette.mode === "dark" ? 0.22 : 0.16),
                  },
                },
              };
            }, {}),
          }}
        />
      </Box>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={isXs}>
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
              <SchedulesIcon />
            </Avatar>
            <Typography variant="h6">{editingId ? "עריכת משמרת" : t("newShift")}</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            select
            label="עובד"
            value={form.employeeId}
            disabled={!!editingId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
          >
            {(employeesQ.data?.items ?? []).map((emp) => (
              <MenuItem key={emp.id} value={emp.id}>
                {emp.fullName} {emp.jobTitle ? `· ${emp.jobTitle}` : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="תאריך"
            InputLabelProps={{ shrink: true }}
            value={form.workDate}
            onChange={(e) => setForm({ ...form, workDate: e.target.value })}
          />
          <TextField
            select
            label="סטטוס"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as StatusKey })}
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
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            helperText="ניתן לפצל יום: למשל 4 שעות משרד + 4 שעות בית (הוסף שני שיבוצים לאותו עובד באותו תאריך)"
          />
          <TextField
            label="הערה"
            multiline
            minRows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={saveMut.isPending || !form.employeeId || !form.workDate}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
