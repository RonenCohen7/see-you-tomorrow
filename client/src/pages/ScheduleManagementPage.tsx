import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import Add from "@mui/icons-material/Add";
import GroupsIcon from "@mui/icons-material/Groups";
import SearchIcon from "@mui/icons-material/Search";
import SchedulesIcon from "@mui/icons-material/EventNote";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PeopleIcon from "@mui/icons-material/People";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import type { Employee, Schedule } from "../types/models";
import { useTranslation } from "react-i18next";
import { useAuth, useRole } from "../store/authContext";
import { ManagerOfficeCoverageBanner } from "../components/ManagerOfficeCoverageBanner";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { todayIsoLocal } from "../utils/date";
import { hebrewWeekdayShort, nextIsraeliWeekUtcFromReference } from "../utils/israeliWeek";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";

type FormState = {
  employeeId: string;
  workDateStart: string;
  workDateEnd: string;
  status: StatusKey;
  hours: string;
  note: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/** סטטוסים שמופיעים בדוח «שיבוץ לפי סטטוס» — לא כולל «לא עובד». */
const SCHEDULE_STATUSES_IN_DAILY_REPORT = new Set<Schedule["status"]>(["office", "home", "vacation", "sick"]);

/** טורקיז לתצוגת «חופשה/נופש» בדיאלוג השבועי בלבד */
const WEEKLY_VACATION_DISPLAY = "#00897B";

const emptyForm: FormState = {
  employeeId: "",
  workDateStart: todayIso(),
  workDateEnd: todayIso(),
  status: "office",
  hours: "",
  note: "",
};

type DeptOption = { id: string; name: string };

type DeptBulkFormState = {
  departmentId: string;
  workDateStart: string;
  workDateEnd: string;
  status: StatusKey;
  hours: string;
  note: string;
};

type DeptPreviewEmployee = {
  employeeId: string;
  fullName: string;
  suggestedInclude: boolean;
  flags: string[];
  daysSummary: { workDate: string; statuses: string[] }[];
};

type DeptPreviewResponse = {
  departmentId: string;
  from: string;
  to: string;
  employees: DeptPreviewEmployee[];
};

const emptyDeptBulkForm: DeptBulkFormState = {
  departmentId: "",
  workDateStart: todayIso(),
  workDateEnd: todayIso(),
  status: "office",
  hours: "",
  note: "",
};

export default function ScheduleManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forReport = searchParams.get("forReport") === "1";
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const role = useRole();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const [deptBulkOpen, setDeptBulkOpen] = useState(false);
  const [deptBulkStep, setDeptBulkStep] = useState<"form" | "review">("form");
  const [deptBulkForm, setDeptBulkForm] = useState<DeptBulkFormState>(emptyDeptBulkForm);
  const [deptPreview, setDeptPreview] = useState<DeptPreviewResponse | null>(null);
  const [deptInclude, setDeptInclude] = useState<Record<string, boolean>>({});

  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyWeek, setWeeklyWeek] = useState<{ weekStartSunday: string; days: string[] } | null>(null);
  const [weeklyDeptId, setWeeklyDeptId] = useState("");
  const [weeklyDraft, setWeeklyDraft] = useState<Record<string, StatusKey>>({});
  const [weeklyLocked, setWeeklyLocked] = useState<Record<string, boolean>>({});
  const [weeklyGridInitKey, setWeeklyGridInitKey] = useState(0);

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

  const deptsQ = useQuery({
    queryKey: ["departments-for-schedule-bulk"],
    queryFn: async () => (await api.get<{ items: DeptOption[] }>("/api/departments")).data.items,
    enabled: role === "admin" || role === "manager",
  });

  const weeklyRangeFrom = weeklyWeek?.days[0];
  const weeklyRangeTo = weeklyWeek?.days[6];

  const weeklyEmpsQ = useQuery({
    queryKey: ["employees-weekly-grid", weeklyDeptId],
    enabled: weeklyOpen && Boolean(weeklyDeptId),
    queryFn: async () => {
      const limit = 100;
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=${limit}&departmentId=${encodeURIComponent(weeklyDeptId)}&isActive=true`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return { items: all, total: all.length };
    },
  });

  const weeklySchedQ = useQuery({
    queryKey: ["schedules-weekly-grid", weeklyRangeFrom, weeklyRangeTo, weeklyDeptId],
    enabled: weeklyOpen && Boolean(weeklyDeptId && weeklyRangeFrom && weeklyRangeTo),
    queryFn: async () =>
      (
        await api.get<{ items: Schedule[] }>(
          `/api/schedules?from=${weeklyRangeFrom}&to=${weeklyRangeTo}&departmentId=${encodeURIComponent(weeklyDeptId)}`
        )
      ).data,
  });

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employeesQ.data?.items ?? []) m.set(e.id, e);
    return m;
  }, [employeesQ.data?.items]);

  const allScheduleRows = useMemo(() => schedulesQ.data?.items ?? [], [schedulesQ.data?.items]);

  const filteredScheduleRows = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return allScheduleRows;
    return allScheduleRows.filter((row) => {
      const emp = employeeMap.get(row.employeeId);
      const name = (emp?.fullName ?? "").toLowerCase();
      const email = (emp?.email ?? "").toLowerCase();
      const id = row.employeeId.toLowerCase();
      return name.includes(q) || email.includes(q) || id.includes(q);
    });
  }, [allScheduleRows, employeeMap, employeeSearch]);

  const employeesMatchingSearch = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return [];
    const items = employeesQ.data?.items ?? [];
    return items.filter((e) => {
      const name = (e.fullName ?? "").toLowerCase();
      const email = (e.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || e.id.toLowerCase().includes(q);
    });
  }, [employeesQ.data?.items, employeeSearch]);

  const employeesMatchedWithoutShifts = useMemo(
    () => employeesMatchingSearch.filter((e) => !allScheduleRows.some((r) => r.employeeId === e.id)),
    [employeesMatchingSearch, allScheduleRows]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (form.workDateStart > form.workDateEnd) {
        const err = new Error("INVALID_DATE_RANGE");
        (err as Error & { code?: string }).code = "INVALID_DATE_RANGE";
        throw err;
      }
      const payload: Record<string, unknown> = {
        status: form.status,
        note: form.note || undefined,
      };
      const h = form.hours.trim() === "" ? undefined : Number(form.hours);
      if (h !== undefined && !Number.isNaN(h)) payload.hours = h;
      if (editingId) {
        if (form.workDateStart === form.workDateEnd) {
          payload.workDate = form.workDateStart;
          return api.put(`/api/schedules/${editingId}`, payload);
        }
        return api.put(`/api/schedules/${editingId}/replace-range`, {
          workDateFrom: form.workDateStart,
          workDateTo: form.workDateEnd,
          status: form.status,
          note: form.note || undefined,
          ...(h !== undefined && !Number.isNaN(h) ? { hours: h } : {}),
        });
      }
      payload.employeeId = form.employeeId;
      if (form.workDateStart === form.workDateEnd) {
        payload.workDate = form.workDateStart;
        return api.post("/api/schedules", payload);
      }
      return api.post("/api/schedules/range", {
        employeeId: form.employeeId,
        workDateFrom: form.workDateStart,
        workDateTo: form.workDateEnd,
        status: form.status,
        note: form.note || undefined,
        ...(h !== undefined && !Number.isNaN(h) ? { hours: h } : {}),
      });
    },
    onSuccess: async (response) => {
      const data = response?.data as { count?: number } | undefined;
      if (data && typeof data.count === "number" && data.count > 1) {
        setToast({ msg: t("schedulesRangeSaved", { count: data.count }), ok: true });
      } else {
        setToast({ msg: t("success"), ok: true });
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: (err) => {
      const code = (err as Error & { code?: string }).code;
      if (code === "INVALID_DATE_RANGE") {
        setToast({ msg: t("schedulesInvalidDateRange"), ok: false });
        return;
      }
      setToast({ msg: apiErrorMessage(err, t("error")), ok: false });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/schedules/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const canWrite = role === "admin" || role === "manager";
  const canDeptBulk = canWrite && (role === "admin" || Boolean(user?.departmentId));

  const scheduleTodayStr = todayIsoLocal();
  const coverageWeek = useMemo(() => nextIsraeliWeekUtcFromReference(), [scheduleTodayStr]);

  const managerCoverageSchedulesQ = useQuery({
    queryKey: ["schedules-manager-coverage", coverageWeek.days[0], coverageWeek.days[6]],
    queryFn: async () =>
      (
        await api.get<{ items: Schedule[] }>(
          `/api/schedules?from=${coverageWeek.days[0]}&to=${coverageWeek.days[6]}`
        )
      ).data.items,
    enabled: canWrite,
    staleTime: 15_000,
  });

  const departmentChoices = useMemo(() => {
    const items = deptsQ.data ?? [];
    if (role === "manager" && user?.departmentId) return items.filter((d) => d.id === user.departmentId);
    return items;
  }, [deptsQ.data, role, user?.departmentId]);

  const weeklyWeekStart = weeklyWeek?.weekStartSunday;
  const weeklyDays = weeklyWeek?.days;

  useEffect(() => {
    if (!weeklyOpen || !weeklyDays?.length || !weeklyDeptId) return;
    if (!weeklyEmpsQ.isSuccess || !weeklySchedQ.isSuccess) return;
    const emps = weeklyEmpsQ.data?.items ?? [];
    const scheds = weeklySchedQ.data?.items ?? [];
    const draft: Record<string, StatusKey> = {};
    const locked: Record<string, boolean> = {};
    for (const emp of emps) {
      for (const wd of weeklyDays) {
        const key = `${emp.id}|${wd}`;
        const rows = scheds.filter((s) => s.employeeId === emp.id && s.workDate === wd);
        if (rows.some((r) => r.status === "vacation")) {
          draft[key] = "vacation";
          locked[key] = true;
        } else if (rows.some((r) => r.status === "sick")) {
          draft[key] = "sick";
          locked[key] = true;
        } else if (rows.length === 0) {
          draft[key] = "office";
        } else {
          draft[key] = rows[0]!.status as StatusKey;
        }
      }
    }
    setWeeklyDraft(draft);
    setWeeklyLocked(locked);
  }, [
    weeklyOpen,
    weeklyWeekStart,
    weeklyDays,
    weeklyDeptId,
    weeklyEmpsQ.isSuccess,
    weeklySchedQ.isSuccess,
    weeklyEmpsQ.data,
    weeklySchedQ.data,
    weeklyGridInitKey,
  ]);

  function openDeptBulk() {
    setDeptBulkStep("form");
    setDeptPreview(null);
    setDeptInclude({});
    const deptId = role === "manager" && user?.departmentId ? user.departmentId : "";
    setDeptBulkForm({ ...emptyDeptBulkForm, departmentId: deptId });
    setDeptBulkOpen(true);
  }

  function openWeeklyGrid() {
    const w = nextIsraeliWeekUtcFromReference();
    setWeeklyWeek(w);
    setWeeklyDeptId(role === "manager" && user?.departmentId ? user.departmentId : "");
    setWeeklyDraft({});
    setWeeklyLocked({});
    setWeeklyOpen(true);
    setWeeklyGridInitKey((k) => k + 1);
  }

  const previewDeptBulkMut = useMutation({
    mutationFn: async () => {
      if (deptBulkForm.workDateStart > deptBulkForm.workDateEnd) {
        const err = new Error("INVALID_DATE_RANGE");
        (err as Error & { code?: string }).code = "INVALID_DATE_RANGE";
        throw err;
      }
      const { data } = await api.post<DeptPreviewResponse>("/api/schedules/department-range/preview", {
        departmentId: deptBulkForm.departmentId,
        workDateFrom: deptBulkForm.workDateStart,
        workDateTo: deptBulkForm.workDateEnd,
      });
      return data;
    },
    onSuccess: (data) => {
      setDeptPreview(data);
      const inc: Record<string, boolean> = {};
      for (const row of data.employees) {
        inc[row.employeeId] = row.suggestedInclude;
      }
      setDeptInclude(inc);
      setDeptBulkStep("review");
    },
    onError: (err) => {
      const code = (err as Error & { code?: string }).code;
      if (code === "INVALID_DATE_RANGE") {
        setToast({ msg: t("schedulesInvalidDateRange"), ok: false });
        return;
      }
      setToast({ msg: apiErrorMessage(err, t("error")), ok: false });
    },
  });

  const applyDeptBulkMut = useMutation({
    mutationFn: async () => {
      const ids = Object.entries(deptInclude)
        .filter(([, v]) => v)
        .map(([id]) => id);
      if (ids.length === 0) {
        const err = new Error("NO_EMPLOYEES_SELECTED");
        (err as Error & { code?: string }).code = "NO_EMPLOYEES_SELECTED";
        throw err;
      }
      if (deptBulkForm.workDateStart > deptBulkForm.workDateEnd) {
        const err = new Error("INVALID_DATE_RANGE");
        (err as Error & { code?: string }).code = "INVALID_DATE_RANGE";
        throw err;
      }
      const h = deptBulkForm.hours.trim() === "" ? undefined : Number(deptBulkForm.hours);
      const { data } = await api.post<{ applied: number; skipped: number }>(
        "/api/schedules/department-range/apply",
        {
          departmentId: deptBulkForm.departmentId,
          workDateFrom: deptBulkForm.workDateStart,
          workDateTo: deptBulkForm.workDateEnd,
          status: deptBulkForm.status,
          note: deptBulkForm.note || undefined,
          includeEmployeeIds: ids,
          ...(h !== undefined && !Number.isNaN(h) ? { hours: h } : {}),
        }
      );
      return data;
    },
    onSuccess: (data) => {
      setToast({ msg: t("deptBulkApplySuccess", { count: data.applied }), ok: true });
      setDeptBulkOpen(false);
      setDeptBulkStep("form");
      setDeptPreview(null);
      setDeptInclude({});
      void qc.invalidateQueries({ queryKey: ["schedules-all"] });
      void qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      void qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: (err) => {
      const code = (err as Error & { code?: string }).code;
      if (code === "NO_EMPLOYEES_SELECTED") {
        setToast({ msg: t("deptBulkNoEmployeesSelected"), ok: false });
        return;
      }
      if (code === "INVALID_DATE_RANGE") {
        setToast({ msg: t("schedulesInvalidDateRange"), ok: false });
        return;
      }
      setToast({ msg: apiErrorMessage(err, t("error")), ok: false });
    },
  });

  const applyWeeklyGridMut = useMutation({
    mutationFn: async () => {
      if (!weeklyWeek || !weeklyDeptId) {
        const err = new Error("NO_WEEK_DEPT");
        (err as Error & { code?: string }).code = "NO_WEEK_DEPT";
        throw err;
      }
      const emps = weeklyEmpsQ.data?.items ?? [];
      const cells = emps.flatMap((emp) =>
        weeklyWeek.days.map((wd) => ({
          employeeId: emp.id,
          workDate: wd,
          status: weeklyDraft[`${emp.id}|${wd}`] ?? "office",
        }))
      );
      const { data } = await api.post<{ updated: number; skippedProtected: number }>(
        "/api/schedules/week-grid/apply",
        {
          departmentId: weeklyDeptId,
          weekStartSunday: weeklyWeek.weekStartSunday,
          cells,
        }
      );
      return data;
    },
    onSuccess: async (data) => {
      let msg = t("weeklyGridApplySuccess", { count: data.updated });
      if (data.skippedProtected > 0) {
        msg += " " + t("weeklyGridApplySkipped", { count: data.skippedProtected });
      }
      setToast({ msg, ok: true });
      setWeeklyOpen(false);
      setWeeklyWeek(null);
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
      await qc.invalidateQueries({ queryKey: ["calendar-month"] });
      await qc.invalidateQueries({ queryKey: ["calendar-next7"] });
      await qc.invalidateQueries({ queryKey: ["calendar-day"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: (err) => {
      const code = (err as Error & { code?: string }).code;
      if (code === "NO_WEEK_DEPT") {
        setToast({ msg: t("weeklyGridSelectDepartment"), ok: false });
        return;
      }
      setToast({ msg: apiErrorMessage(err, t("error")), ok: false });
    },
  });

  function weeklyStatusColor(s: StatusKey) {
    return s === "vacation" ? WEEKLY_VACATION_DISPLAY : statusMeta[s].color;
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openCreateForEmployee(employeeId: string) {
    setEditingId(null);
    setForm({ ...emptyForm, employeeId });
    setOpen(true);
  }

  function openEdit(row: Schedule) {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      workDateStart: row.workDate,
      workDateEnd: row.workDate,
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

  const weeklyEmpsList = weeklyEmpsQ.data?.items ?? [];

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack
        direction="row"
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 1.25, flexWrap: "wrap", gap: 1 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
          <SchedulesIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.2rem", sm: "1.65rem" } }}>
            {t("schedules")}
          </Typography>
          <Chip
            size="small"
            label={
              employeeSearch.trim()
                ? t("schedulesFilteredCount", {
                    filtered: filteredScheduleRows.length,
                    total: allScheduleRows.length,
                  })
                : `${allScheduleRows.length} ${t("total")}`
            }
          />
        </Stack>
        {canWrite && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }} flexWrap="wrap" useFlexGap>
            <Tooltip title={t("newShift")}>
              <IconButton
                color="primary"
                onClick={openCreate}
                aria-label={t("newShift")}
                sx={{
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": { bgcolor: "primary.dark" },
                }}
              >
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title={!canDeptBulk ? t("deptBulkManagerNoDept") : t("weeklyGridOpen")}>
              <span>
                <IconButton
                  color="primary"
                  disabled={!canDeptBulk}
                  onClick={openWeeklyGrid}
                  aria-label={t("weeklyGridOpen")}
                  sx={{
                    border: "1px solid",
                    borderColor: "primary.main",
                    borderRadius: 1,
                  }}
                >
                  <CalendarMonthIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={!canDeptBulk ? t("deptBulkManagerNoDept") : t("deptBulkOpen")}>
              <span>
                <IconButton
                  color="primary"
                  disabled={!canDeptBulk}
                  onClick={openDeptBulk}
                  aria-label={t("deptBulkOpen")}
                  sx={{
                    border: "1px solid",
                    borderColor: "primary.main",
                    borderRadius: 1,
                  }}
                >
                  <PeopleIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      <Box
        sx={(th) => ({
          mb: 1.25,
          p: { xs: 1.25, sm: 1.5 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(th.palette.primary.main, th.palette.mode === "dark" ? 0.1 : 0.05),
          borderInlineStart: "4px solid",
          borderInlineStartColor: "primary.main",
        })}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75, color: "text.primary" }}>
          {t("schedulesPageWhatFor")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.5 }}>
          {t("schedulesPageDescription")}
        </Typography>
      </Box>

      {forReport ? (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          {t("schedulesForReportBanner")}
        </Alert>
      ) : null}

      {canWrite ? (
        <ManagerOfficeCoverageBanner
          employees={employeesQ.data?.items ?? []}
          schedules={managerCoverageSchedulesQ.data ?? []}
          weekDays={coverageWeek.days}
          ready={Boolean(employeesQ.data && !employeesQ.isLoading && !managerCoverageSchedulesQ.isLoading)}
        />
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
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

      <TextField
        size="small"
        label={t("schedulesEmployeeSearchLabel")}
        placeholder={t("schedulesEmployeeSearchPlaceholder")}
        value={employeeSearch}
        onChange={(e) => setEmployeeSearch(e.target.value)}
        sx={{ mb: 1.5, maxWidth: { xs: "100%", sm: 400 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        inputProps={{ "aria-label": t("schedulesEmployeeSearchLabel") }}
      />

      {employeeSearch.trim() && filteredScheduleRows.length === 0 && employeesMatchedWithoutShifts.length > 0 ? (
        <Alert
          severity="info"
          sx={{ mb: 1.5 }}
          action={
            employeesMatchedWithoutShifts.length === 1 && canWrite ? (
              <Button color="inherit" size="small" onClick={() => openCreateForEmployee(employeesMatchedWithoutShifts[0].id)}>
                {t("schedulesSearchOpenNewShift")}
              </Button>
            ) : undefined
          }
        >
          {t("schedulesSearchEmployeeFoundNoShifts", {
            names: employeesMatchedWithoutShifts.map((e) => e.fullName || e.email).join(" · "),
          })}
        </Alert>
      ) : null}

      {employeeSearch.trim() && filteredScheduleRows.length === 0 && employeesMatchingSearch.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t("schedulesSearchNoEmployeeMatch")}
        </Alert>
      ) : null}

      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          height: { xs: "min(calc(100dvh - 340px), 52vh)", sm: "min(calc(100dvh - 280px), 68vh)" },
          minHeight: { xs: 280, sm: 320 },
          maxHeight: { xs: 560, md: 720 },
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DataGrid
          density="compact"
          rows={filteredScheduleRows}
          getRowId={(r) => r.id}
          loading={schedulesQ.isLoading || employeesQ.isLoading}
          columns={columns}
          getRowClassName={({ row }) => `syt-row syt-row--${row.status}`}
          onRowDoubleClick={(params) => {
            const row = params.row;
            if (!SCHEDULE_STATUSES_IN_DAILY_REPORT.has(row.status)) {
              setToast({ msg: t("schedulesReportSkipOffStatus"), ok: false });
              return;
            }
            const sp = new URLSearchParams({
              employeeId: row.employeeId,
              from: row.workDate,
              to: row.workDate,
              status: row.status,
            });
            navigate(`/reports?${sp.toString()}`);
          }}
          initialState={{
            sorting: { sortModel: [{ field: "workDate", sort: "desc" }] },
            pagination: { paginationModel: { pageSize: 20, page: 0 } },
          }}
          pageSizeOptions={[10, 15, 20, 25, 50]}
          sx={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            minWidth: 0,
            borderRadius: 2,
            "& .MuiDataGrid-cell": {
              borderColor: "divider",
              alignItems: "flex-start",
              py: 0.5,
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

      <Dialog
        open={deptBulkOpen}
        onClose={() => {
          setDeptBulkOpen(false);
          setDeptBulkStep("form");
          setDeptPreview(null);
          setDeptInclude({});
        }}
        fullWidth
        maxWidth="md"
        fullScreen={isXs}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "secondary.main", color: "secondary.contrastText" }}>
              <GroupsIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">{t("deptBulkTitle")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {deptBulkStep === "form" ? t("deptBulkStepForm") : t("deptBulkStepReview")}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {deptBulkStep === "form" ? (
            <Stack spacing={2}>
              <Alert severity="info">{t("deptBulkFormIntro")}</Alert>
              <TextField
                select
                required
                label={t("department")}
                value={deptBulkForm.departmentId}
                disabled={role === "manager" && Boolean(user?.departmentId)}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, departmentId: e.target.value })}
              >
                <MenuItem value="">{t("deptBulkSelectDepartment")}</MenuItem>
                {departmentChoices.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label={t("schedulesDateFrom")}
                InputLabelProps={{ shrink: true }}
                value={deptBulkForm.workDateStart}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, workDateStart: e.target.value })}
              />
              <TextField
                type="date"
                label={t("schedulesDateTo")}
                InputLabelProps={{ shrink: true }}
                value={deptBulkForm.workDateEnd}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, workDateEnd: e.target.value })}
              />
              <Typography variant="caption" color="text.secondary">
                {t("schedulesDateRangeHint")}
              </Typography>
              <TextField
                select
                label={t("notificationsStatusLabel")}
                value={deptBulkForm.status}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, status: e.target.value as StatusKey })}
              >
                {STATUS_ORDER.map((s) => {
                  const meta = statusMeta[s];
                  return (
                    <MenuItem key={s} value={s}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <meta.Icon sx={{ color: meta.color, fontSize: 18 }} />
                        <span>{t(meta.i18nKey)}</span>
                      </Stack>
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                label={t("deptBulkHoursOptional")}
                type="number"
                inputProps={{ min: 0, max: 24, step: 0.5 }}
                value={deptBulkForm.hours}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, hours: e.target.value })}
              />
              <TextField
                label={t("note")}
                multiline
                minRows={2}
                value={deptBulkForm.note}
                onChange={(e) => setDeptBulkForm({ ...deptBulkForm, note: e.target.value })}
              />
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert severity="warning">{t("deptBulkReviewWarning")}</Alert>
              <Alert severity="info" sx={{ py: 0.75 }}>
                {t("deptBulkAutoSkippedHint")}
              </Alert>
              {!deptPreview?.employees.length ? (
                <Typography color="text.secondary">{t("deptBulkNoEmployeesInDept")}</Typography>
              ) : (
                <Table size="small" sx={{ minWidth: 520 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">{t("deptBulkIncludeColumn")}</TableCell>
                      <TableCell>{t("deptBulkEmployeeColumn")}</TableCell>
                      <TableCell>{t("deptBulkFlagsColumn")}</TableCell>
                      <TableCell>{t("deptBulkDaysColumn")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deptPreview.employees.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={Boolean(deptInclude[row.employeeId])}
                            onChange={(_, checked) =>
                              setDeptInclude((prev) => ({ ...prev, [row.employeeId]: checked }))
                            }
                            inputProps={{ "aria-label": row.fullName }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight={600}>{row.fullName}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {row.flags.includes("vacation_or_sick_in_range") ? (
                              <Chip size="small" color="warning" variant="outlined" label={t("deptBulkFlagVacationSick")} />
                            ) : null}
                            {row.flags.includes("has_other_schedules") ? (
                              <Chip size="small" color="default" variant="outlined" label={t("deptBulkFlagOther")} />
                            ) : null}
                            {!row.flags.length ? (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.daysSummary.length
                              ? t("deptBulkDaysWithSchedules", { count: row.daysSummary.length })
                              : "—"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            onClick={() => {
              setDeptBulkOpen(false);
              setDeptBulkStep("form");
              setDeptPreview(null);
              setDeptInclude({});
            }}
          >
            {t("cancel")}
          </Button>
          {deptBulkStep === "review" ? (
            <Button onClick={() => setDeptBulkStep("form")}>{t("deptBulkBackButton")}</Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {deptBulkStep === "form" ? (
            <Button
              variant="contained"
              disabled={
                previewDeptBulkMut.isPending ||
                !deptBulkForm.departmentId ||
                !deptBulkForm.workDateStart ||
                !deptBulkForm.workDateEnd
              }
              onClick={() => previewDeptBulkMut.mutate()}
            >
              {previewDeptBulkMut.isPending ? t("loading") : t("deptBulkPreviewButton")}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              disabled={applyDeptBulkMut.isPending || !deptPreview?.employees.length}
              onClick={() => applyDeptBulkMut.mutate()}
            >
              {applyDeptBulkMut.isPending ? t("loading") : t("deptBulkApplyButton")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={weeklyOpen}
        onClose={() => {
          setWeeklyOpen(false);
          setWeeklyWeek(null);
        }}
        fullWidth
        maxWidth="lg"
        fullScreen={isXs}
      >
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
              <ViewWeekIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">{t("weeklyGridTitle")}</Typography>
              {weeklyWeek ? (
                <Typography variant="caption" color="text.secondary">
                  {t("weeklyGridWeekRange", { from: weeklyWeek.days[0], to: weeklyWeek.days[6] })}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="info">{t("weeklyGridIntro")}</Alert>
            <TextField
              select
              required
              label={t("department")}
              value={weeklyDeptId}
              disabled={role === "manager" && Boolean(user?.departmentId)}
              onChange={(e) => {
                setWeeklyDeptId(e.target.value);
                setWeeklyGridInitKey((k) => k + 1);
              }}
            >
              <MenuItem value="">{t("weeklyGridSelectDepartment")}</MenuItem>
              {departmentChoices.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </TextField>
            {weeklyDeptId && weeklyWeek && (weeklyEmpsQ.isLoading || weeklySchedQ.isLoading) ? (
              <Typography color="text.secondary">{t("loading")}</Typography>
            ) : null}
            {weeklyDeptId && weeklyEmpsQ.isSuccess && weeklyEmpsList.length === 0 ? (
              <Typography color="text.secondary">{t("weeklyGridNoEmployees")}</Typography>
            ) : null}
            {weeklyDeptId && weeklyWeek && weeklyEmpsQ.isSuccess && weeklyEmpsList.length > 0 ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 140 }}>{t("weeklyGridColumnEmployee")}</TableCell>
                      {weeklyWeek.days.map((wd) => (
                        <TableCell key={wd} align="center" sx={{ minWidth: 112, px: 0.5 }}>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {hebrewWeekdayShort(wd)}
                          </Typography>
                          <Typography variant="caption" fontWeight={700} display="block">
                            {wd.slice(5)}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {weeklyEmpsList.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>
                          <Typography fontWeight={600}>{emp.fullName ?? emp.email}</Typography>
                        </TableCell>
                        {weeklyWeek.days.map((wd) => {
                          const cellKey = `${emp.id}|${wd}`;
                          const st = weeklyDraft[cellKey] ?? "office";
                          const locked = Boolean(weeklyLocked[cellKey]);
                          const col = weeklyStatusColor(st);
                          return (
                            <TableCell key={wd} align="center" sx={{ px: 0.5, verticalAlign: "top" }}>
                              <Select
                                size="small"
                                fullWidth
                                value={st}
                                disabled={locked}
                                onChange={(e) => {
                                  const v = e.target.value as StatusKey;
                                  setWeeklyDraft((prev) => ({ ...prev, [cellKey]: v }));
                                }}
                                inputProps={{ "aria-label": `${emp.fullName ?? emp.id} ${wd}` }}
                                sx={{
                                  bgcolor: alpha(col, 0.14),
                                  "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha(col, 0.45) },
                                  "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor: alpha(col, 0.75),
                                  },
                                  "&.Mui-disabled": {
                                    bgcolor: alpha(col, 0.1),
                                  },
                                }}
                                renderValue={(selected) => {
                                  const sk = selected as StatusKey;
                                  const m = statusMeta[sk];
                                  const c = weeklyStatusColor(sk);
                                  return (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                      <m.Icon sx={{ fontSize: 16, color: c }} />
                                      <Typography variant="caption" fontWeight={700} sx={{ color: c }}>
                                        {t(m.i18nKey)}
                                      </Typography>
                                    </Stack>
                                  );
                                }}
                              >
                                {STATUS_ORDER.map((s) => {
                                  const m = statusMeta[s];
                                  return (
                                    <MenuItem key={s} value={s}>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <m.Icon sx={{ fontSize: 18, color: weeklyStatusColor(s) }} />
                                        <span>{t(m.i18nKey)}</span>
                                      </Stack>
                                    </MenuItem>
                                  );
                                })}
                              </Select>
                              {locked ? (
                                <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.25 }}>
                                  {t("weeklyGridLockedShort")}
                                </Typography>
                              ) : null}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
          <Button
            onClick={() => {
              setWeeklyOpen(false);
              setWeeklyWeek(null);
            }}
          >
            {t("cancel")}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            disabled={
              applyWeeklyGridMut.isPending ||
              !weeklyDeptId ||
              !weeklyWeek ||
              weeklyEmpsList.length === 0
            }
            onClick={() => applyWeeklyGridMut.mutate()}
          >
            {applyWeeklyGridMut.isPending ? t("loading") : t("weeklyGridSave")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={isXs}>
        <DialogTitle>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
              <SchedulesIcon />
            </Avatar>
            <Typography variant="h6">{editingId ? t("schedulesEditShift") : t("newShift")}</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {editingId ? (
            <Alert severity="warning" sx={{ py: 0.75 }}>
              {t("schedulesEditRangeReplaceWarning")}
            </Alert>
          ) : null}
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
            label={t("schedulesDateFrom")}
            InputLabelProps={{ shrink: true }}
            value={form.workDateStart}
            onChange={(e) => setForm({ ...form, workDateStart: e.target.value })}
          />
          <TextField
            type="date"
            label={t("schedulesDateTo")}
            InputLabelProps={{ shrink: true }}
            value={form.workDateEnd}
            onChange={(e) => setForm({ ...form, workDateEnd: e.target.value })}
          />
          <Typography variant="caption" color="text.secondary">
            {t("schedulesDateRangeHint")}
          </Typography>
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
            disabled={saveMut.isPending || !form.employeeId || !form.workDateStart || !form.workDateEnd}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? t("loading") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
