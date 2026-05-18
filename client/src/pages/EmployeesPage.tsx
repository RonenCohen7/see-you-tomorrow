import {
  Alert,
  Avatar,
  Backdrop,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Link,
  Tab,
  Tabs,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import EmployeesIcon from "@mui/icons-material/PeopleAlt";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import PhoneIcon from "@mui/icons-material/PhoneOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CallIcon from "@mui/icons-material/CallOutlined";
import SendEmailIcon from "@mui/icons-material/Send";
import WorkIcon from "@mui/icons-material/WorkOutline";
import DepartmentIcon from "@mui/icons-material/AccountTree";
import LocationOnIcon from "@mui/icons-material/LocationOnOutlined";
import CakeIcon from "@mui/icons-material/CakeOutlined";
import HomeIcon from "@mui/icons-material/HomeOutlined";
import FavoriteIcon from "@mui/icons-material/FavoriteBorder";
import BadgeIcon from "@mui/icons-material/BadgeOutlined";
import NotesIcon from "@mui/icons-material/StickyNote2Outlined";
import EditIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/AddCircle";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import EmergencyIcon from "@mui/icons-material/MedicalServices";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import type { Employee, MaritalStatus } from "../types/models";
import { useRole } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import {
  applyUnmappedExtrasToNotes,
  csvImportNeedsNotesConsent,
  parseEmployeesCsv,
  type BulkImportEmployeePayload,
  type CsvAdaptation,
  type CsvParseIssue,
} from "../utils/employeesCsvImport";
import {
  employeeMissingRequiredFields,
  type EmployeeRequiredFieldKey,
} from "../utils/employeeRequirements";
import { downloadCsv } from "../utils/csvDownload";
import { fileToResizedJpegDataUrl } from "../utils/imageResize";

const MARITAL_STATUSES: MaritalStatus[] = ["single", "married", "divorced", "widowed", "partner"];

type Dept = { id: string; name: string; accentColor?: string; isActive?: boolean };
type Loc = { id: string; name: string; isActive?: boolean };

type FormState = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  imageUrl: string;
  jobTitle: string;
  departmentId: string;
  locationId: string;
  role: "admin" | "manager" | "employee";
  isActive: boolean;
  birthDate: string;
  address: string;
  maritalStatus: MaritalStatus | "";
  emergencyContact: string;
  notes: string;
};

const emptyForm: FormState = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  imageUrl: "",
  jobTitle: "",
  departmentId: "",
  locationId: "",
  role: "employee",
  isActive: true,
  birthDate: "",
  address: "",
  maritalStatus: "",
  emergencyContact: "",
  notes: "",
};

function looseEmailOk(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** Subtle background on required outlined fields — warm when empty/invalid, cool when satisfied. */
function requiredOutlinedFieldSx(theme: Theme, satisfied: boolean): SxProps<Theme> {
  const okBg = alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.14 : 0.072);
  const needBg = alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.16 : 0.09);
  return {
    "& .MuiOutlinedInput-root": {
      backgroundColor: satisfied ? okBg : needBg,
      transition: theme.transitions.create(["background-color"], { duration: theme.transitions.duration.shorter }),
    },
  };
}

function isEmployeeFormComplete(form: FormState, isEdit: boolean): boolean {
  const oidDept = /^[a-f\d]{24}$/i.test(form.departmentId.trim());
  const passOk = isEdit || form.password.trim().length >= 8;
  return (
    !!form.fullName.trim() &&
    !!form.email.trim() &&
    !!form.birthDate &&
    !!form.phone.trim() &&
    !!form.address.trim() &&
    !!form.maritalStatus &&
    !!form.jobTitle.trim() &&
    oidDept &&
    passOk
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

function avatarColor(seed: string): string {
  // Stable hue from string — keeps the palette varied yet consistent per employee
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 50%)`;
}

/**
 * Normalize a phone number for WhatsApp's wa.me protocol.
 * - Strips formatting (spaces, dashes, parentheses, plus)
 * - Israeli local numbers starting with "0" get the 972 country code
 * - Returns an empty string if no digits remain
 */
function toWhatsAppNumber(raw: string | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  return digits;
}

function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function whatsappHref(phone: string): string {
  const num = toWhatsAppNumber(phone);
  return num ? `https://wa.me/${num}` : "";
}

/** Skype URI: international digits with leading + (same normalization as WhatsApp). */
function skypeHref(phone: string): string {
  const digits = toWhatsAppNumber(phone);
  return digits ? `skype:+${digits}?chat` : "";
}

type BulkImportApiResult = {
  created: number;
  updatedExisting: number;
  unchangedExisting: number;
  skippedInvalid: number;
  errors: { row: number; email?: string; code: string; message: string }[];
};

/** Canonical column order for re-editing / re-import spreadsheets. */
const BULK_IMPORT_CSV_HEADERS: readonly string[] = [
  "fullName",
  "email",
  "birthDate",
  "phone",
  "address",
  "maritalStatus",
  "jobTitle",
  "departmentId",
  "role",
  "isActive",
  "locationId",
  "managerId",
  "emergencyContact",
  "notes",
];

function bulkImportRowsToCsvRows(rows: BulkImportEmployeePayload[]): Record<string, string>[] {
  return rows.map((r) => ({
    fullName: r.fullName,
    email: r.email,
    birthDate: r.birthDate,
    phone: r.phone,
    address: r.address,
    maritalStatus: r.maritalStatus,
    jobTitle: r.jobTitle,
    departmentId: r.departmentId,
    role: r.role ?? "",
    isActive: r.isActive !== undefined ? String(r.isActive) : "",
    locationId: r.locationId ?? "",
    managerId: r.managerId ?? "",
    emergencyContact: r.emergencyContact ?? "",
    notes: r.notes ?? "",
  }));
}

function csvIssueDetail(issue: CsvParseIssue, tr: TFunction): string {
  switch (issue.code) {
    case "MISSING_REQUIRED":
      return tr("employeesCsvIssue_MISSING_REQUIRED");
    case "INVALID_EMAIL":
      return tr("employeesCsvIssue_INVALID_EMAIL");
    case "INVALID_ROLE":
      return tr("employeesCsvIssue_INVALID_ROLE");
    case "INVALID_MARITAL":
      return tr("employeesCsvIssue_INVALID_MARITAL");
    case "INVALID_BIRTHDATE":
      return tr("employeesCsvIssue_INVALID_BIRTHDATE");
    case "INVALID_ISACTIVE":
      return tr("employeesCsvIssue_INVALID_ISACTIVE");
    case "MISSING_REQUIRED_FIELD":
      return tr("employeesCsvIssue_MISSING_REQUIRED_FIELD", {
        field: tr(`employeeRequiredField.${issue.field}`),
      });
    case "INVALID_REFERENCE_ID":
      return tr("employeesCsvIssue_INVALID_REFERENCE_ID", {
        field: tr(`employeeRequiredField.${issue.field}`),
      });
  }
}

function csvAdaptationLine(a: CsvAdaptation, tr: TFunction): string {
  switch (a.kind) {
    case "header_alias":
      return tr("employeesCsvAdaptation_header_alias", { from: a.from, to: a.to });
    case "birthdate_reformatted":
      return tr("employeesCsvAdaptation_birthdate", { row: a.row, from: a.from, to: a.to });
    case "marital_mapped":
      return tr("employeesCsvAdaptation_marital", { row: a.row, from: a.from, to: a.to });
    case "role_mapped":
      return tr("employeesCsvAdaptation_role", { row: a.row, from: a.from, to: a.to });
    case "deferred_reference_column":
      return tr("employeesCsvAdaptation_deferred_column", { column: a.column });
    case "unmapped_column":
      return tr("employeesCsvAdaptation_unmapped_column", { column: a.column });
  }
}

export default function EmployeesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const qc = useQueryClient();
  const role = useRole();
  const canWrite = role === "admin";
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [openEmployee, setOpenEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    const id = searchParams.get("openEmployeeId");
    if (!id || !canWrite) return;

    let alive = true;
    (async () => {
      try {
        const { data } = await api.get<Employee>(`/api/employees/${encodeURIComponent(id)}`);
        if (alive) setOpenEmployee(data);
      } catch {
        /** ignore invalid id / forbidden */
      } finally {
        if (!alive) return;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("openEmployeeId");
            return next;
          },
          { replace: true },
        );
      }
    })();

    return () => {
      alive = false;
    };
  }, [searchParams, setSearchParams, canWrite]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvPassword, setCsvPassword] = useState("");
  const [csvPreparedRows, setCsvPreparedRows] = useState<BulkImportEmployeePayload[] | null>(null);
  const [csvFileLabel, setCsvFileLabel] = useState("");
  const [csvIssues, setCsvIssues] = useState<CsvParseIssue[]>([]);
  const [csvParserMessages, setCsvParserMessages] = useState<string[]>([]);
  const [csvMissingRequiredColumns, setCsvMissingRequiredColumns] = useState<EmployeeRequiredFieldKey[]>([]);
  const [csvSummaryOpen, setCsvSummaryOpen] = useState(false);
  const [csvSummary, setCsvSummary] = useState<BulkImportApiResult | null>(null);
  const [csvLastImportRows, setCsvLastImportRows] = useState<BulkImportEmployeePayload[]>([]);
  const [csvScanningFile, setCsvScanningFile] = useState(false);
  const [csvExtrasPerRow, setCsvExtrasPerRow] = useState<Record<string, string>[]>([]);
  const [csvAdaptations, setCsvAdaptations] = useState<CsvAdaptation[]>([]);
  const [csvNotesConsentApproved, setCsvNotesConsentApproved] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [reportsTab, setReportsTab] = useState(0);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const csvNeedsNotesConsent = useMemo(() => csvImportNeedsNotesConsent(csvExtrasPerRow), [csvExtrasPerRow]);

  const reportEmployeesQ = useQuery({
    queryKey: ["employees-compliance-list"],
    queryFn: async () =>
      (await api.get<{ items: Employee[]; total: number }>("/api/employees?page=1&limit=2500")).data.items,
    enabled: reportsDialogOpen && canWrite,
    staleTime: 30_000,
  });

  const q = useQuery({
    queryKey: ["employees", page, pageSize, search, activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set("search", search);
      if (activeOnly) params.set("isActive", "true");
      return (await api.get<{ items: Employee[]; total: number }>(`/api/employees?${params}`)).data;
    },
  });

  const deptsQ = useQuery({
    queryKey: ["departments-for-emp"],
    queryFn: async () => (await api.get<{ items: Dept[] }>("/api/departments")).data.items,
  });
  const locsQ = useQuery({
    queryKey: ["locations-for-emp"],
    queryFn: async () => (await api.get<{ items: Loc[] }>("/api/locations")).data.items,
  });

  const deptById = useMemo(() => new Map(deptsQ.data?.map((d) => [d.id, d]) ?? []), [deptsQ.data]);
  const deptMap = useMemo(() => new Map(deptsQ.data?.map((d) => [d.id, d.name])), [deptsQ.data]);
  const locMap = useMemo(() => new Map(locsQ.data?.map((l) => [l.id, l.name])), [locsQ.data]);

  const deptPickerOptions = useMemo(() => {
    const all = deptsQ.data ?? [];
    const active = all.filter((d) => d.isActive !== false);
    const cid = form.departmentId.trim();
    if (/^[a-f\d]{24}$/i.test(cid) && !active.some((d) => d.id === cid)) {
      const cur = all.find((d) => d.id === cid);
      if (cur) return [...active, cur];
    }
    return active;
  }, [deptsQ.data, form.departmentId]);

  const locPickerOptions = useMemo(() => {
    const all = locsQ.data ?? [];
    const active = all.filter((l) => l.isActive !== false);
    const lid = form.locationId.trim();
    if (/^[a-f\d]{24}$/i.test(lid) && !active.some((l) => l.id === lid)) {
      const cur = all.find((l) => l.id === lid);
      if (cur) return [...active, cur];
    }
    return active;
  }, [locsQ.data, form.locationId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        imageUrl: form.imageUrl || undefined,
        jobTitle: form.jobTitle.trim(),
        departmentId: form.departmentId.trim(),
        locationId: form.locationId.trim() || undefined,
        role: form.role,
        isActive: form.isActive,
        birthDate: form.birthDate,
        address: form.address.trim(),
        maritalStatus: form.maritalStatus,
        emergencyContact: form.emergencyContact.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editingId) {
        if (form.password) payload.password = form.password;
        return api.put(`/api/employees/${editingId}`, payload);
      }
      payload.password = form.password;
      return api.post("/api/employees", payload);
    },
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await qc.invalidateQueries({ queryKey: ["employees"] });
      await qc.invalidateQueries({ queryKey: ["employees-compliance-list"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const avatarMut = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const imageUrl = await fileToResizedJpegDataUrl(file);
      return (await api.put<Employee>(`/api/employees/${id}`, { imageUrl })).data;
    },
    onSuccess: (data) => {
      setToast({ msg: t("success"), ok: true });
      void qc.invalidateQueries({ queryKey: ["employees"] });
      setOpenEmployee((prev) => (prev?.id === data.id ? data : prev));
    },
    onError: (err) => {
      let msg = apiErrorMessage(err, t("error"));
      if (err instanceof Error) {
        if (err.message === "INVALID_TYPE") msg = t("photoUploadInvalidType");
        else if (err.message === "TOO_LARGE") msg = t("photoUploadTooLarge");
      }
      setToast({ msg, ok: false });
    },
  });

  const importBulkMut = useMutation({
    mutationFn: async (payload: { defaultPassword: string; rows: BulkImportEmployeePayload[] }) =>
      (await api.post<BulkImportApiResult>("/api/employees/import-bulk", payload)).data,
    onSuccess: async (data, variables) => {
      setCsvSummary(data);
      setCsvLastImportRows([...variables.rows]);
      setCsvSummaryOpen(true);
      setCsvDialogOpen(false);
      setToast({ msg: t("employeesCsvSuccessImportToast"), ok: true });
      setCsvPassword("");
      setCsvPreparedRows(null);
      setCsvFileLabel("");
      setCsvIssues([]);
      setCsvParserMessages([]);
      setCsvMissingRequiredColumns([]);
      setCsvExtrasPerRow([]);
      setCsvAdaptations([]);
      setCsvNotesConsentApproved(false);
      await qc.invalidateQueries({ queryKey: ["employees"] });
      await qc.invalidateQueries({ queryKey: ["employees-compliance-list"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const bulkApplyActiveStatusesMut = useMutation({
    mutationFn: async (changes: readonly { id: string; isActive: boolean }[]) => {
      await Promise.all(
        changes.map(({ id, isActive }) =>
          api.put<Employee>(`/api/employees/${id}`, { isActive }),
        ),
      );
    },
    onSuccess: async (_, vars) => {
      setToast({ msg: t("employeesReportActiveApplied", { count: vars.length }), ok: true });
      await qc.invalidateQueries({ queryKey: ["employees"] });
      await qc.invalidateQueries({ queryKey: ["employees-compliance-list"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  function requestAvatarUpload(employeeId: string, file: File) {
    avatarMut.mutate({ id: employeeId, file });
  }

  function openCsvImport() {
    setCsvDialogOpen(true);
    setCsvPassword("");
    setCsvPreparedRows(null);
    setCsvFileLabel("");
    setCsvIssues([]);
    setCsvParserMessages([]);
    setCsvMissingRequiredColumns([]);
    setCsvExtrasPerRow([]);
    setCsvAdaptations([]);
    setCsvNotesConsentApproved(false);
    setCsvScanningFile(false);
    setCsvLastImportRows([]);
  }

  function handleCsvFilePick(file: File) {
    setCsvFileLabel(file.name);
    setCsvScanningFile(true);
    setCsvPreparedRows(null);
    setCsvIssues([]);
    setCsvParserMessages([]);
    setCsvMissingRequiredColumns([]);
    setCsvExtrasPerRow([]);
    setCsvAdaptations([]);
    setCsvNotesConsentApproved(false);
    const reader = new FileReader();
    reader.onerror = () => {
      setCsvScanningFile(false);
      setToast({ msg: t("employeesCsvImportReadFailed"), ok: false });
    };
    reader.onload = () => {
      const text = String(reader.result ?? "");
      queueMicrotask(() => {
        try {
          const parsed = parseEmployeesCsv(text, MARITAL_STATUSES);
          setCsvMissingRequiredColumns([...parsed.missingRequiredColumns]);
          setCsvParserMessages(parsed.parserMessages);
          setCsvIssues(parsed.issues);
          setCsvPreparedRows(parsed.rows);
          setCsvExtrasPerRow(parsed.extrasPerRow);
          setCsvAdaptations(parsed.adaptations);
        } finally {
          setCsvScanningFile(false);
        }
      });
    };
    reader.readAsText(file, "UTF-8");
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({
      fullName: emp.fullName,
      email: emp.email,
      password: "",
      phone: emp.phone ?? "",
      imageUrl: emp.imageUrl ?? "",
      jobTitle: emp.jobTitle ?? "",
      departmentId: emp.departmentId ?? "",
      locationId: emp.locationId ?? "",
      role: emp.role,
      isActive: emp.isActive,
      birthDate: emp.birthDate ?? "",
      address: emp.address ?? "",
      maritalStatus: emp.maritalStatus ?? "",
      emergencyContact: emp.emergencyContact ?? "",
      notes: emp.notes ?? "",
    });
    setOpenEmployee(null);
    setFormOpen(true);
  }

  const totalPages = Math.max(1, Math.ceil((q.data?.total ?? 0) / pageSize));
  const items = q.data?.items ?? [];

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack
        direction="row"
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 0.5, flexWrap: "wrap", gap: 1.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <EmployeesIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("employees")}
          </Typography>
          {q.data?.total != null && (
            <Chip
              size="small"
              label={q.data.total}
              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.16), color: "primary.main", fontWeight: 800 }}
            />
          )}
        </Stack>
        {canWrite && (
          <Stack direction="row" sx={{ flexShrink: 0, gap: 2 }} alignItems="center">
            <Tooltip title={t("employeesReportsTooltip")} placement="left" arrow disableInteractive>
              <Button
                variant="outlined"
                onClick={() => setReportsDialogOpen(true)}
                sx={{ minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
                aria-label={t("employeesReportsTooltip")}
              >
                <AssessmentOutlined />
              </Button>
            </Tooltip>
            <Tooltip title={t("employeesCsvImportTooltip")} placement="left" arrow disableInteractive>
              <Button
                variant="outlined"
                onClick={openCsvImport}
                sx={{ minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
                aria-label={t("employeesCsvImportTooltip")}
              >
                <UploadFileOutlined />
              </Button>
            </Tooltip>
            <Tooltip title={t("newEmployeeTooltip")} placement="left" arrow disableInteractive>
              <Button
                variant="contained"
                onClick={openCreate}
                sx={{ minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
                aria-label={t("newEmployeeTooltip")}
              >
                <AddIcon />
              </Button>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        sx={{ mb: 3, flexWrap: "wrap", rowGap: 1.5 }}
      >
        <TextField
          placeholder={t("search")}
          size="small"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: "100%", sm: "auto" },
            minWidth: { sm: 200, md: 260 },
            maxWidth: { sm: 480 },
            flex: { sm: "1 1 260px" },
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Switch
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(1);
            }}
            size="small"
          />
          <Typography variant="body2">{t("activeOnly")}</Typography>
        </Stack>
      </Stack>

      <Typography
        component="p"
        lang="en"
        sx={(th) => ({
          direction: "ltr",
          textAlign: "center",
          fontSize: { xs: "0.98rem", sm: "1.1rem" },
          fontWeight: 500,
          fontStyle: "italic",
          letterSpacing: "0.03em",
          lineHeight: 1.5,
          color: alpha(th.palette.text.primary, 0.62),
          mb: 3,
          px: { xs: 1, sm: 2 },
          maxWidth: 720,
          mx: "auto",
        })}
      >
        {t("taglineEmployees")}
      </Typography>

      {q.isLoading ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              sm: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
              md: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            },
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={170} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Card sx={{ p: 6, textAlign: "center" }}>
          <EmployeesIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">{t("noData")}</Typography>
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              sm: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
              md: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            },
          }}
        >
          {items.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              departmentName={emp.departmentId ? deptMap?.get(emp.departmentId) : undefined}
              departmentAccentColor={
                emp.departmentId ? deptById.get(emp.departmentId)?.accentColor : undefined
              }
              canWrite={canWrite}
              avatarUploading={avatarMut.isPending && avatarMut.variables?.id === emp.id}
              onAvatarUpload={(file) => requestAvatarUpload(emp.id, file)}
              onOpen={() => setOpenEmployee(emp)}
            />
          ))}
        </Box>
      )}

      {totalPages > 1 && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={totalPages} page={page} onChange={(_, p) => setPage(p)} color="primary" />
        </Stack>
      )}

      <EmployeeDetailDialog
        employee={openEmployee}
        fullScreen={isXs}
        departmentName={openEmployee?.departmentId ? deptMap?.get(openEmployee.departmentId) : undefined}
        departmentAccentColor={
          openEmployee?.departmentId ? deptById.get(openEmployee.departmentId)?.accentColor : undefined
        }
        locationName={openEmployee?.locationId ? locMap?.get(openEmployee.locationId) : undefined}
        canWrite={canWrite}
        avatarUploading={!!openEmployee && avatarMut.isPending && avatarMut.variables?.id === openEmployee.id}
        onAvatarUpload={
          openEmployee && canWrite ? (file) => requestAvatarUpload(openEmployee.id, file) : undefined
        }
        onClose={() => setOpenEmployee(null)}
        onEdit={canWrite ? openEdit : undefined}
      />

      <EmployeeFormDialog
        open={formOpen}
        fullScreen={isXs}
        editingId={editingId}
        form={form}
        setForm={setForm}
        departments={deptPickerOptions}
        locations={locPickerOptions}
        isPending={saveMut.isPending}
        isSaveDisabled={!isEmployeeFormComplete(form, !!editingId) || saveMut.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        onSubmit={() => saveMut.mutate()}
      />

      <EmployeesReportsDialog
        open={reportsDialogOpen}
        onClose={() => setReportsDialogOpen(false)}
        tab={reportsTab}
        onTabChange={setReportsTab}
        items={reportEmployeesQ.data ?? []}
        isLoading={reportEmployeesQ.isPending}
        deptNames={deptMap}
        onEdit={(emp) => {
          setReportsDialogOpen(false);
          openEdit(emp);
        }}
        onBulkApplyActiveStatuses={(changes) => bulkApplyActiveStatusesMut.mutateAsync(changes)}
        isApplyingActiveStatuses={bulkApplyActiveStatusesMut.isPending}
      />

      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleCsvFilePick(f);
        }}
      />

      <Backdrop
        open={csvScanningFile || importBulkMut.isPending}
        sx={{
          color: "#fff",
          zIndex: (th) => th.zIndex.modal + 10,
          flexDirection: "column",
          gap: 2,
        }}
      >
        <CircularProgress color="inherit" />
        <Typography variant="body1">
          {importBulkMut.isPending ? t("employeesCsvBackdropUploading") : t("employeesCsvBackdropScanning")}
        </Typography>
      </Backdrop>

      <Dialog
        open={csvDialogOpen}
        onClose={() => {
          if (importBulkMut.isPending || csvScanningFile) return;
          setCsvDialogOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("employeesCsvImportTitle")}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <Alert severity="warning">
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {t("employeesCsvImportWarning")}
              </Typography>
            </Alert>
            <Alert severity="info" sx={{ alignItems: "flex-start" }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {t("employeesCsvBulkMergeExplain")}
              </Typography>
            </Alert>
            <TextField
              type="password"
              label={t("employeesCsvImportPasswordLabel")}
              value={csvPassword}
              onChange={(e) => setCsvPassword(e.target.value)}
              fullWidth
              autoComplete="new-password"
              helperText={
                csvPassword.trim().length > 0 && csvPassword.trim().length < 8 ? t("passwordHint") : undefined
              }
              error={csvPassword.trim().length > 0 && csvPassword.trim().length < 8}
            />
            <Button
              variant="outlined"
              onClick={() => csvFileInputRef.current?.click()}
              disabled={importBulkMut.isPending || csvScanningFile}
            >
              {t("employeesCsvImportChooseFile")}
            </Button>
            {csvFileLabel ? (
              <Typography variant="body2" color="text.secondary">
                {csvPreparedRows != null
                  ? t("employeesCsvImportFileReady", {
                      name: csvFileLabel,
                      count: csvPreparedRows.length,
                    })
                  : csvFileLabel}
              </Typography>
            ) : null}
            {csvMissingRequiredColumns.length ? (
              <Alert severity="error">
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {t("employeesCsvMissingHeadersIntro")}
                </Typography>
                {csvMissingRequiredColumns.map((col) => (
                  <Typography key={col} variant="caption" display="block">
                    · {t(`employeeRequiredField.${col}`)}
                  </Typography>
                ))}
              </Alert>
            ) : null}
            {csvParserMessages.length ? (
              <Alert severity="error">
                {csvParserMessages.map((m, i) => (
                  <Typography key={i} variant="caption" display="block">
                    {m}
                  </Typography>
                ))}
              </Alert>
            ) : null}
            {csvIssues.length ? (
              <Alert severity="error">
                <Box sx={{ maxHeight: 180, overflow: "auto" }}>
                  {csvIssues.map((issue, i) => (
                    <Typography key={`${issue.row}-${issue.code}-${i}`} variant="caption" display="block">
                      {t("employeesCsvIssueLine", {
                        row: issue.row,
                        detail: csvIssueDetail(issue, t),
                      })}
                    </Typography>
                  ))}
                </Box>
              </Alert>
            ) : null}
            {csvPreparedRows?.length &&
            !csvIssues.length &&
            !csvMissingRequiredColumns.length &&
            csvAdaptations.filter((ad) => ad.kind !== "unmapped_column" && ad.kind !== "deferred_reference_column").length >
              0 ? (
              <Alert severity="info" sx={{ alignItems: "flex-start" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t("employeesCsvAdaptationsTitle")}
                </Typography>
                <Box sx={{ maxHeight: 160, overflow: "auto", pr: 0.5 }}>
                  {csvAdaptations
                    .filter((ad) => ad.kind !== "unmapped_column" && ad.kind !== "deferred_reference_column")
                    .slice(0, 48)
                    .map((ad, i) => (
                      <Typography key={`${ad.kind}-${i}`} variant="caption" display="block">
                        {csvAdaptationLine(ad, t)}
                      </Typography>
                    ))}
                </Box>
              </Alert>
            ) : null}
            {csvAdaptations.some((ad) => ad.kind === "unmapped_column" || ad.kind === "deferred_reference_column") ? (
              <Alert severity="warning" sx={{ alignItems: "flex-start" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  {t("employeesCsvExtraColumnsIntro")}
                </Typography>
                <Box sx={{ maxHeight: 120, overflow: "auto" }}>
                  {[...csvAdaptations]
                    .filter((ad) => ad.kind === "unmapped_column" || ad.kind === "deferred_reference_column")
                    .map((ad, i) => (
                      <Typography key={`${ad.kind}-${i}`} variant="caption" display="block">
                        {csvAdaptationLine(ad, t)}
                      </Typography>
                    ))}
                </Box>
              </Alert>
            ) : null}
            {csvNeedsNotesConsent ? (
              <FormControlLabel
                sx={{ alignItems: "flex-start", ml: 0 }}
                control={
                  <Checkbox
                    checked={csvNotesConsentApproved}
                    onChange={(e) => setCsvNotesConsentApproved(e.target.checked)}
                    sx={{ pt: 0.25 }}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">{t("employeesCsvNotesConsentLabel")}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("employeesCsvNotesConsentHint")}
                    </Typography>
                  </Box>
                }
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={importBulkMut.isPending || csvScanningFile}
            onClick={() => setCsvDialogOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={
              importBulkMut.isPending ||
              csvScanningFile ||
              csvPassword.trim().length < 8 ||
              !csvPreparedRows?.length ||
              csvIssues.length > 0 ||
              csvMissingRequiredColumns.length > 0 ||
              csvParserMessages.length > 0 ||
              (csvNeedsNotesConsent && !csvNotesConsentApproved)
            }
            onClick={() => {
              if (!csvPreparedRows?.length || csvPassword.trim().length < 8) return;
              const rowsToImport = csvNeedsNotesConsent
                ? applyUnmappedExtrasToNotes(csvPreparedRows, csvExtrasPerRow)
                : csvPreparedRows;
              importBulkMut.mutate({
                defaultPassword: csvPassword.trim(),
                rows: rowsToImport,
              });
            }}
          >
            {importBulkMut.isPending ? <CircularProgress color="inherit" size={22} /> : t("employeesCsvImportSubmit")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={csvSummaryOpen} onClose={() => setCsvSummaryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("employeesCsvSummaryTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>{t("employeesCsvSummaryCreated", { count: csvSummary?.created ?? 0 })}</Typography>
            <Typography>{t("employeesCsvSummaryUpdatedExisting", { count: csvSummary?.updatedExisting ?? 0 })}</Typography>
            <Typography>
              {t("employeesCsvSummaryUnchangedExisting", { count: csvSummary?.unchangedExisting ?? 0 })}
            </Typography>
            <Typography>
              {t("employeesCsvSummarySkippedInvalid", { count: csvSummary?.skippedInvalid ?? 0 })}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlined />}
                disabled={csvLastImportRows.length === 0}
                onClick={() =>
                  downloadCsv(
                    `employees-import-${Date.now()}.csv`,
                    BULK_IMPORT_CSV_HEADERS,
                    bulkImportRowsToCsvRows(csvLastImportRows)
                  )
                }
              >
                {t("employeesCsvSummaryDownloadSentRows")}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadOutlined />}
                disabled={!(csvSummary?.errors?.length ?? 0)}
                onClick={() => {
                  const errRows =
                    csvSummary?.errors.map((er) => ({
                      row: String(er.row),
                      email: er.email ?? "",
                      code: er.code,
                      message: er.message,
                    })) ?? [];
                  downloadCsv(
                    `employees-import-errors-${Date.now()}.csv`,
                    ["row", "email", "code", "message"],
                    errRows
                  );
                }}
              >
                {t("employeesCsvSummaryDownloadErrors")}
              </Button>
            </Stack>
            {(csvSummary?.errors?.length ?? 0) > 0 ? (
              <>
                <Typography sx={{ mt: 1 }} variant="subtitle2">
                  {t("employeesCsvSummaryErrorsIntro")}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("employeesCsvSummaryColRow")}</TableCell>
                      <TableCell>{t("employeesCsvSummaryColEmail")}</TableCell>
                      <TableCell>{t("employeesCsvSummaryColDetail")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(csvSummary?.errors ?? []).map((er, i) => (
                      <TableRow key={`${er.row}-${er.code}-${i}`}>
                        <TableCell>{er.row}</TableCell>
                        <TableCell>{er.email ?? "—"}</TableCell>
                        <TableCell>{er.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCsvSummaryOpen(false)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function EmployeeCard({
  employee,
  departmentName,
  departmentAccentColor,
  onOpen,
  canWrite,
  avatarUploading,
  onAvatarUpload,
}: {
  employee: Employee;
  departmentName?: string;
  departmentAccentColor?: string;
  onOpen: () => void;
  canWrite: boolean;
  avatarUploading: boolean;
  onAvatarUpload: (file: File) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fallbackAccent = avatarColor(employee.id);
  const topAccent = departmentAccentColor ?? fallbackAccent;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card
      className="syt-lift"
      sx={{
        position: "relative",
        overflow: "hidden",
        opacity: employee.isActive ? 1 : 0.65,
        ...(departmentAccentColor
          ? {
              border: `2px solid ${departmentAccentColor}`,
              boxShadow: `0 0 0 1px ${alpha(departmentAccentColor, 0.25)} inset`,
            }
          : {}),
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          height: 4,
          background: departmentAccentColor
            ? `linear-gradient(90deg, ${departmentAccentColor} 0%, ${alpha(departmentAccentColor, 0.55)} 100%)`
            : `linear-gradient(90deg, ${topAccent} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
        },
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ p: 0 }}>
        <CardContent sx={{ pt: 2.5, px: 2, pb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                title={employee.fullName}
                sx={{
                  wordBreak: "break-word",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {employee.fullName}
              </Typography>
              {employee.jobTitle && (
                <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ color: "text.secondary", minWidth: 0 }}>
                  <WorkIcon sx={{ fontSize: 14, flexShrink: 0, mt: 0.2 }} />
                  <Typography
                    variant="body2"
                    title={employee.jobTitle}
                    sx={{
                      wordBreak: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                  >
                    {employee.jobTitle}
                  </Typography>
                </Stack>
              )}
              {departmentName && (
                <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ color: "text.secondary", mt: 0.25, minWidth: 0 }}>
                  <DepartmentIcon sx={{ fontSize: 14, flexShrink: 0, mt: 0.15 }} />
                  <Typography
                    variant="caption"
                    title={departmentName}
                    sx={{
                      wordBreak: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minWidth: 0,
                    }}
                  >
                    {departmentName}
                  </Typography>
                </Stack>
              )}
            </Box>
            {!employee.isActive && (
              <Chip size="small" label={t("inactive")} color="default" sx={{ height: 20, flexShrink: 0 }} />
            )}
          </Stack>

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              mt: 1.25,
              mb: 1,
              minHeight: 56,
              alignItems: "center",
            }}
          >
            <Box sx={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
              <Avatar
                src={employee.imageUrl || undefined}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: topAccent,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 20,
                  boxShadow: `0 4px 14px -2px ${alpha(topAccent, 0.55)}`,
                  border: `2px solid ${alpha(theme.palette.background.paper, 0.95)}`,
                  opacity: avatarUploading ? 0.55 : 1,
                }}
              >
                {initials(employee.fullName)}
              </Avatar>
              {avatarUploading && (
                <CircularProgress
                  size={40}
                  thickness={4}
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    marginTop: "-20px",
                    marginLeft: "-20px",
                  }}
                />
              )}
              {canWrite && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = "";
                      if (file) onAvatarUpload(file);
                    }}
                  />
                  <Tooltip title={t("uploadEmployeePhoto")} arrow>
                    <IconButton
                      type="button"
                      size="small"
                      disabled={avatarUploading}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      sx={{
                        position: "absolute",
                        bottom: -2,
                        insetInlineEnd: -2,
                        bgcolor: "background.paper",
                        boxShadow: 1,
                        width: 28,
                        height: 28,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                      aria-label={t("uploadEmployeePhoto")}
                    >
                      <PhotoCameraIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 0 }} />

          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ color: "text.secondary", minWidth: 0 }}>
              <EmailIcon sx={{ fontSize: 16, flexShrink: 0, mt: 0.15 }} />
              <Typography
                variant="caption"
                sx={{ direction: "ltr", wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0 }}
                title={employee.email}
              >
                {employee.email}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
              <PhoneIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ direction: "ltr" }}>
                {employee.phone || "—"}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function EmployeeDetailDialog({
  employee,
  fullScreen,
  departmentName,
  departmentAccentColor,
  locationName,
  onClose,
  onEdit,
  canWrite,
  onAvatarUpload,
  avatarUploading,
}: {
  employee: Employee | null;
  fullScreen?: boolean;
  departmentName?: string;
  departmentAccentColor?: string;
  locationName?: string;
  onClose: () => void;
  onEdit?: (emp: Employee) => void;
  canWrite?: boolean;
  onAvatarUpload?: (file: File) => void;
  avatarUploading?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!employee) return null;
  const accent = departmentAccentColor ?? avatarColor(employee.id);
  const showPhotoUpload = Boolean(canWrite && onAvatarUpload);

  return (
    <Dialog
      open={!!employee}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={!!fullScreen}
      slotProps={{ paper: { sx: { m: fullScreen ? 0 : undefined } } }}
    >
      <Box
        sx={{
          position: "relative",
          p: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          background: `linear-gradient(135deg, ${alpha(accent, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
        }}
      >
        <IconButton size="small" onClick={onClose} sx={{ position: "absolute", top: 8, insetInlineEnd: 8 }}>
          <CloseIcon />
        </IconButton>
        <Stack
          direction="row"
          spacing={{ xs: 1.5, sm: 2.5 }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ flexWrap: "wrap", rowGap: 1.5, pr: { xs: 4, sm: 0 } }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: "1.15rem", sm: "1.5rem" }, wordBreak: "break-word" }}>
              {employee.fullName}
            </Typography>
            {employee.jobTitle && (
              <Typography color="text.secondary" sx={{ mt: 0.25, wordBreak: "break-word" }}>
                {employee.jobTitle}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={t(`role.${employee.role}`)}
                sx={{ bgcolor: alpha(accent, 0.16), color: accent, fontWeight: 700 }}
              />
              <Chip
                size="small"
                label={employee.isActive ? t("active") : t("inactive")}
                color={employee.isActive ? "success" : "default"}
                variant={employee.isActive ? "filled" : "outlined"}
              />
            </Stack>
          </Box>
          {onEdit && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => onEdit(employee)}
              sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: { xs: "stretch", sm: "center" } }}
            >
              {t("edit")}
            </Button>
          )}
        </Stack>
      </Box>
      <DialogContent dividers sx={{ pt: { xs: 2, sm: 3 }, overflowY: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
            gap: { xs: 2, sm: 3 },
          }}
        >
          <DetailSection title={t("contactInfo")}>
            <ContactRow
              Icon={EmailIcon}
              label={t("email")}
              ltr
              valueNode={
                <Link
                  component="a"
                  href={mailtoHref(employee.email)}
                  underline="hover"
                  sx={{ direction: "ltr", fontWeight: 600, wordBreak: "break-all" }}
                >
                  {employee.email}
                </Link>
              }
              footer={
                <Button
                  component="a"
                  href={mailtoHref(employee.email)}
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<SendEmailIcon />}
                >
                  {t("sendEmail")}
                </Button>
              }
            />
            <ContactRow
              Icon={PhoneIcon}
              label={t("phone")}
              ltr
              valueNode={
                <Typography variant="body2" sx={{ direction: "ltr", fontWeight: 600 }}>
                  {employee.phone || "—"}
                </Typography>
              }
              footer={
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  flexWrap="wrap"
                  useFlexGap
                  spacing={1}
                  sx={{ alignItems: { xs: "stretch", sm: "center" } }}
                >
                  <Tooltip title={employee.phone ? t("openWhatsAppWeb") : t("phoneRequiredForChat")} arrow>
                    <span>
                      <Button
                        component="a"
                        href={employee.phone ? whatsappHref(employee.phone) : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="outlined"
                        disabled={!employee.phone}
                        startIcon={<WhatsAppIcon />}
                        sx={{
                          borderColor: "#25D366",
                          color: "#128C7E",
                          "&:not(.Mui-disabled):hover": { borderColor: "#25D366", bgcolor: alpha("#25D366", 0.08) },
                        }}
                      >
                        {t("whatsApp")}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={employee.phone ? t("startPhoneCall") : t("phoneRequiredForCall")} arrow>
                    <span>
                      <Button
                        component="a"
                        href={employee.phone ? telHref(employee.phone) : undefined}
                        size="small"
                        variant="outlined"
                        disabled={!employee.phone}
                        startIcon={<CallIcon />}
                      >
                        {t("call")}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={employee.phone ? t("openInSkype") : t("phoneRequiredForChat")} arrow>
                    <span>
                      <Button
                        component="a"
                        href={employee.phone ? skypeHref(employee.phone) : undefined}
                        size="small"
                        variant="outlined"
                        disabled={!employee.phone}
                        sx={{
                          borderColor: "#00AFF0",
                          color: "#0078D4",
                          "&:not(.Mui-disabled):hover": { borderColor: "#00AFF0", bgcolor: alpha("#00AFF0", 0.08) },
                        }}
                      >
                        {t("skype")}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              }
            />
            <DetailRow Icon={HomeIcon} label={t("address")} value={employee.address || "—"} />
            <DetailRow
              Icon={EmergencyIcon}
              label={t("emergencyContact")}
              value={employee.emergencyContact || "—"}
            />
          </DetailSection>

          <DetailSection title={t("workInfo")}>
            <DetailRow Icon={WorkIcon} label={t("jobTitle")} value={employee.jobTitle || "—"} />
            <DetailRow Icon={DepartmentIcon} label={t("department")} value={departmentName || t("noDepartment")} />
            <DetailRow Icon={LocationOnIcon} label={t("location")} value={locationName || t("noLocation")} />
            <DetailRow Icon={BadgeIcon} label={t("role")} value={t(`role.${employee.role}`)} />
          </DetailSection>

          <DetailSection title={t("personalInfo")}>
            <DetailRow Icon={CakeIcon} label={t("birthDate")} value={employee.birthDate || "—"} ltr />
            <DetailRow
              Icon={FavoriteIcon}
              label={t("maritalStatus")}
              value={employee.maritalStatus ? t(`ms.${employee.maritalStatus}`) : "—"}
            />
          </DetailSection>

          {employee.notes && (
            <DetailSection title={t("notes")}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <NotesIcon sx={{ color: "text.secondary", mt: 0.25 }} />
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                  {employee.notes}
                </Typography>
              </Stack>
            </DetailSection>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            gap: 2,
            flexWrap: "wrap",
            mt: 2,
            pt: 2,
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Box sx={{ position: "relative", width: { xs: 112, sm: 132 }, height: { xs: 112, sm: 132 }, flexShrink: 0 }}>
            <Avatar
              src={employee.imageUrl || undefined}
              sx={{
                width: "100%",
                height: "100%",
                bgcolor: accent,
                color: "#fff",
                fontWeight: 800,
                fontSize: { xs: 36, sm: 44 },
                boxShadow: `0 8px 24px -6px ${alpha(accent, 0.45)}`,
                border: `3px solid ${theme.palette.background.paper}`,
                opacity: avatarUploading ? 0.55 : 1,
              }}
            >
              {initials(employee.fullName)}
            </Avatar>
            {avatarUploading && (
              <CircularProgress
                size={56}
                thickness={3.5}
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  marginTop: "-28px",
                  marginLeft: "-28px",
                }}
              />
            )}
            {showPhotoUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (file) onAvatarUpload?.(file);
                  }}
                />
                <Tooltip title={t("uploadEmployeePhoto")} arrow>
                  <IconButton
                    type="button"
                    size="small"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      position: "absolute",
                      bottom: -4,
                      insetInlineEnd: -4,
                      bgcolor: "background.paper",
                      boxShadow: 2,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    aria-label={t("uploadEmployeePhoto")}
                  >
                    <PhotoCameraIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: ".1em", fontWeight: 700 }}>
        {title}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 1 }}>
        {children}
      </Stack>
    </Box>
  );
}

function DetailRow({
  Icon,
  label,
  value,
  ltr,
}: {
  Icon: React.ComponentType<{ sx?: object }>;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Tooltip title={label} arrow>
        <Icon sx={{ color: "text.secondary", fontSize: 18 }} />
      </Tooltip>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            direction: ltr ? "ltr" : "rtl",
            fontWeight: 600,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "normal",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function ContactRow({
  Icon,
  label,
  value,
  valueNode,
  ltr,
  footer,
}: {
  Icon: React.ComponentType<{ sx?: object }>;
  label: string;
  /** Plain string value (used when valueNode is omitted) */
  value?: string;
  /** Rich value (e.g. mailto link); takes precedence over `value` */
  valueNode?: ReactNode;
  ltr?: boolean;
  /** Full-width row below the value — e.g. labeled action buttons */
  footer?: ReactNode;
}) {
  const body =
    valueNode ??
    (
      <Typography
        variant="body2"
        sx={{
          direction: ltr ? "ltr" : "rtl",
          fontWeight: 600,
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          whiteSpace: "normal",
        }}
      >
        {value}
      </Typography>
    );

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Tooltip title={label} arrow>
          <Icon sx={{ color: "text.secondary", fontSize: 18, mt: 0.25 }} />
        </Tooltip>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1 }}>
            {label}
          </Typography>
          {body}
        </Box>
      </Stack>
      {footer ? (
        <Box sx={{ paddingInlineStart: { xs: 0, sm: 3.5 } }}>{footer}</Box>
      ) : null}
    </Stack>
  );
}

function EmployeesReportsDialog({
  open,
  onClose,
  tab,
  onTabChange,
  items,
  isLoading,
  deptNames,
  onEdit,
  onBulkApplyActiveStatuses,
  isApplyingActiveStatuses,
}: {
  open: boolean;
  onClose: () => void;
  tab: number;
  onTabChange: (tab: number) => void;
  items: Employee[];
  isLoading: boolean;
  deptNames: Map<string, string>;
  onEdit: (employee: Employee) => void;
  onBulkApplyActiveStatuses: (changes: readonly { id: string; isActive: boolean }[]) => Promise<void>;
  isApplyingActiveStatuses: boolean;
}) {
  const { t } = useTranslation();
  const seedDoneRef = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftActiveById, setDraftActiveById] = useState<Record<string, boolean>>({});
  const [baselineActiveById, setBaselineActiveById] = useState<Record<string, boolean>>({});
  const [keepActiveSwitchIds, setKeepActiveSwitchIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      seedDoneRef.current = false;
      setDraftReady(false);
      setDraftActiveById({});
      setBaselineActiveById({});
      setKeepActiveSwitchIds(new Set());
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || isLoading || seedDoneRef.current) return;
    seedDoneRef.current = true;
    const next: Record<string, boolean> = {};
    for (const e of items) next[e.id] = e.isActive;
    setDraftActiveById(next);
    setBaselineActiveById(next);
    setKeepActiveSwitchIds(new Set());
    setDraftReady(true);
  }, [open, isLoading, items]);

  const incomplete = useMemo(
    () =>
      items
        .filter((e) => employeeMissingRequiredFields(e).length > 0)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })),
    [items],
  );

  const allSorted = useMemo(
    () => [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })),
    [items],
  );

  const hasUnsavedActiveChanges = useMemo(() => {
    if (!draftReady) return false;
    return items.some((emp) => {
      const d = draftActiveById[emp.id] ?? emp.isActive;
      const b = baselineActiveById[emp.id] ?? emp.isActive;
      return d !== b;
    });
  }, [draftReady, items, draftActiveById, baselineActiveById]);

  const activeStatusChanges = useMemo(() => {
    if (!draftReady) return [];
    return items
      .map((emp) => {
        const d = draftActiveById[emp.id] ?? emp.isActive;
        const b = baselineActiveById[emp.id] ?? emp.isActive;
        return { id: emp.id, isActiveDraft: d, baseline: b };
      })
      .filter((row) => row.isActiveDraft !== row.baseline)
      .map((row) => ({ id: row.id, isActive: row.isActiveDraft }));
  }, [draftReady, items, draftActiveById, baselineActiveById]);

  const requestCloseDialog = () => {
    if (hasUnsavedActiveChanges && !window.confirm(t("employeesReportActiveDiscardConfirm"))) return;
    onClose();
  };

  async function commitActiveStatuses() {
    const snapshot = activeStatusChanges;
    if (snapshot.length === 0) return;
    try {
      await onBulkApplyActiveStatuses(snapshot);
      setBaselineActiveById((b) => {
        const merged = { ...b };
        for (const row of snapshot) merged[row.id] = row.isActive;
        return merged;
      });
    } catch {
      /* toast handled in mutation */
    }
  }

  function deactivateAllExceptPinnedActive() {
    setDraftActiveById((prev) => {
      const next = { ...prev };
      for (const emp of allSorted) {
        next[emp.id] = keepActiveSwitchIds.has(emp.id);
      }
      return next;
    });
  }

  function isDraftActiveFor(emp: Employee): boolean {
    if (!draftReady) return emp.isActive;
    return draftActiveById[emp.id] ?? emp.isActive;
  }

  return (
    <Dialog open={open} onClose={requestCloseDialog} fullWidth maxWidth="md">
      <DialogTitle>{t("employeesReportsTitle")}</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Tabs value={tab} onChange={(_, v) => onTabChange(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tab label={t("employeesReportTabIncomplete")} />
          <Tab label={t("employeesReportTabActiveStatus")} />
        </Tabs>
        {!isLoading ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              disabled={incomplete.length === 0}
              onClick={() => {
                const headers = ["id", "fullName", "email", "departmentId", "departmentName", "missingFields"];
                const rows = incomplete.map((emp) => ({
                  id: emp.id,
                  fullName: emp.fullName,
                  email: emp.email,
                  departmentId: emp.departmentId ?? "",
                  departmentName: emp.departmentId ? (deptNames.get(emp.departmentId) ?? "") : "",
                  missingFields: employeeMissingRequiredFields(emp).join(";"),
                }));
                downloadCsv(`employees-missing-required-${Date.now()}.csv`, headers, rows);
              }}
            >
              {t("employeesReportsDownloadIncomplete")}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              disabled={allSorted.length === 0 || !draftReady}
              onClick={() => {
                const headers = ["id", "fullName", "email", "departmentId", "departmentName", "isActive"];
                const rows = allSorted.map((emp) => ({
                  id: emp.id,
                  fullName: emp.fullName,
                  email: emp.email,
                  departmentId: emp.departmentId ?? "",
                  departmentName: emp.departmentId ? (deptNames.get(emp.departmentId) ?? "") : "",
                  isActive: isDraftActiveFor(emp) ? "true" : "false",
                }));
                downloadCsv(`employees-active-status-${Date.now()}.csv`, headers, rows);
              }}
            >
              {t("employeesReportsDownloadActive")}
            </Button>
          </Stack>
        ) : null}
        {tab === 1 && !isLoading && draftReady && allSorted.length > 0 ? (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {t("employeesReportActiveDraftHint")}
              </Typography>
            </Alert>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
              <Tooltip title={t("employeesReportDeactivateExceptKeptTooltip")} arrow>
                <Box component="span" sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}>
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    disabled={allSorted.length === 0 || isApplyingActiveStatuses}
                    onClick={deactivateAllExceptPinnedActive}
                  >
                    {t("employeesReportDeactivateExceptKeptButton")}
                  </Button>
                </Box>
              </Tooltip>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: { sm: "70%" }, lineHeight: 1.5 }}>
                {t("employeesReportKeepActiveCaption")}
              </Typography>
            </Stack>
          </>
        ) : null}
        {isLoading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : tab === 0 ? (
          incomplete.length === 0 ? (
            <Typography color="text.secondary">{t("employeesReportIncompleteEmpty")}</Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t("employeesReportIncompleteColName")}</TableCell>
                    <TableCell>{t("employeesReportIncompleteColEmail")}</TableCell>
                    <TableCell>{t("employeesReportIncompleteColDept")}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>{t("employeesReportIncompleteColMissing")}</TableCell>
                    <TableCell align="right">{t("employeesReportIncompleteEdit")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incomplete.map((emp) => {
                    const miss = employeeMissingRequiredFields(emp);
                    return (
                      <TableRow key={emp.id} hover>
                        <TableCell>{emp.fullName}</TableCell>
                        <TableCell sx={{ direction: "ltr" }}>{emp.email}</TableCell>
                        <TableCell>{emp.departmentId ? deptNames.get(emp.departmentId) ?? "—" : "—"}</TableCell>
                        <TableCell>
                          <Stack direction="row" gap={0.5} flexWrap="wrap">
                            {miss.map((f) => (
                              <Chip key={f} size="small" label={t(`employeeRequiredField.${f}`)} variant="outlined" />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => onEdit(emp)} startIcon={<EditIcon />}>
                            {t("edit")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )
        ) : !draftReady ? (
          <Typography color="text.secondary">{t("employeesReportDraftLoadingHint")}</Typography>
        ) : allSorted.length === 0 ? (
          <Typography color="text.secondary">{t("employeesReportActiveEmpty")}</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 440 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t("employeesReportActiveColName")}</TableCell>
                  <TableCell>{t("employeesReportActiveColEmail")}</TableCell>
                  <TableCell>{t("employeesReportActiveColDept")}</TableCell>
                  <TableCell align="center">{t("employeesReportActiveColActive")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allSorted.map((emp) => (
                  <TableRow key={emp.id} hover>
                    <TableCell>{emp.fullName}</TableCell>
                    <TableCell sx={{ direction: "ltr" }}>{emp.email}</TableCell>
                    <TableCell>{emp.departmentId ? deptNames.get(emp.departmentId) ?? "—" : "—"}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={t("employeesReportActiveSwitchTooltip")}>
                        <span>
                          <Switch
                            checked={isDraftActiveFor(emp)}
                            disabled={isApplyingActiveStatuses}
                            onChange={(_, checked) => {
                              setDraftActiveById((p) => ({ ...p, [emp.id]: checked }));
                              setKeepActiveSwitchIds((prev) => {
                                const copy = new Set(prev);
                                if (checked) copy.add(emp.id);
                                else copy.delete(emp.id);
                                return copy;
                              });
                            }}
                            size="small"
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
        {tab === 1 && draftReady && allSorted.length > 0 ? (
          <Button
            variant="contained"
            disabled={activeStatusChanges.length === 0 || isApplyingActiveStatuses}
            startIcon={
              isApplyingActiveStatuses ? <CircularProgress color="inherit" size={18} sx={{ mr: -0.5 }} /> : undefined
            }
            onClick={() => void commitActiveStatuses()}
          >
            {t("employeesReportApplyStatuses")}
          </Button>
        ) : null}
        <Box sx={{ flexGrow: { xs: 0, sm: 1 }, minWidth: 8 }} />
        <Button onClick={requestCloseDialog}>{t("close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function EmployeeFormDialog({
  open,
  fullScreen,
  editingId,
  form,
  setForm,
  departments,
  locations,
  isPending,
  isSaveDisabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  fullScreen?: boolean;
  editingId: string | null;
  form: FormState;
  setForm: (f: FormState) => void;
  departments: Dept[];
  locations: Loc[];
  isPending: boolean;
  isSaveDisabled: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={!!fullScreen}
      slotProps={{ paper: { sx: { m: fullScreen ? 0 : undefined } } }}
    >
      <DialogTitle>{editingId ? t("edit") : t("newEmployee")}</DialogTitle>
      <DialogContent dividers sx={{ pt: 2, overflowY: "auto" }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          {t("personalInfo")}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 1 }}>
          <TextField
            required
            label={t("fullName")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, !!form.fullName.trim())}
          />
          <TextField
            required
            label={t("birthDate")}
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, !!form.birthDate.trim())}
          />
          <TextField
            required
            label={t("address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            sx={{ gridColumn: { sm: "1 / span 2" }, ...requiredOutlinedFieldSx(theme, !!form.address.trim()) }}
          />
          <TextField
            required
            select
            label={t("maritalStatus")}
            value={form.maritalStatus}
            onChange={(e) => setForm({ ...form, maritalStatus: e.target.value as MaritalStatus | "" })}
            sx={requiredOutlinedFieldSx(theme, Boolean(form.maritalStatus))}
          >
            <MenuItem value="" disabled>
              {t("selectMaritalPlaceholder")}
            </MenuItem>
            {MARITAL_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {t(`ms.${s}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("emergencyContact")}
            value={form.emergencyContact}
            onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          {t("contactInfo")}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 1 }}>
          <TextField
            required
            label={t("email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, looseEmailOk(form.email))}
          />
          <TextField
            required
            label={t("phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, !!form.phone.trim())}
          />
          <TextField
            label={editingId ? `${t("password")} (השאר ריק כדי לא לשנות)` : t("password")}
            type="password"
            value={form.password}
            required={!editingId}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            sx={editingId ? undefined : requiredOutlinedFieldSx(theme, form.password.trim().length >= 8)}
          />
          <TextField
            label="תמונה (URL)"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          {t("workInfo")}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2, mt: 1 }}>
          <TextField
            required
            label={t("jobTitle")}
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, !!form.jobTitle.trim())}
          />
          <TextField
            select
            label={t("role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as FormState["role"] })}
          >
            <MenuItem value="admin">{t("role.admin")}</MenuItem>
            <MenuItem value="manager">{t("role.manager")}</MenuItem>
            <MenuItem value="employee">{t("role.employee")}</MenuItem>
          </TextField>
          <TextField
            required
            select
            label={t("department")}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            sx={requiredOutlinedFieldSx(theme, /^[a-f\d]{24}$/i.test(form.departmentId.trim()))}
          >
            <MenuItem value="" disabled>
              {t("selectDepartmentPlaceholder")}
            </MenuItem>
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
                {d.isActive === false ? ` (${t("inactive")})` : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("location")}
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
          >
            <MenuItem value="">{t("noLocation")}</MenuItem>
            {locations.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
                {l.isActive === false ? ` (${t("inactive")})` : ""}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Divider sx={{ my: 3 }} />

        <TextField
          label={t("notes")}
          fullWidth
          multiline
          minRows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          <Typography variant="body2">{form.isActive ? t("active") : t("inactive")}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button
          variant="contained"
          disabled={isSaveDisabled}
          onClick={onSubmit}
        >
          {isPending ? t("loading") : t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
