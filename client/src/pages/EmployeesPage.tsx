import {
  Alert,
  Avatar,
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
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
  Link,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EmployeesIcon from "@mui/icons-material/PeopleAlt";
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
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import EmergencyIcon from "@mui/icons-material/MedicalServices";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import type { Employee, MaritalStatus } from "../types/models";
import { useRole } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { fileToResizedJpegDataUrl } from "../utils/imageResize";

const MARITAL_STATUSES: MaritalStatus[] = ["single", "married", "divorced", "widowed", "partner"];

type Dept = { id: string; name: string; accentColor?: string };
type Loc = { id: string; name: string };

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

export default function EmployeesPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const qc = useQueryClient();
  const role = useRole();
  const canWrite = role === "admin";
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [openEmployee, setOpenEmployee] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

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

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        imageUrl: form.imageUrl || undefined,
        jobTitle: form.jobTitle || undefined,
        departmentId: form.departmentId || undefined,
        locationId: form.locationId || undefined,
        role: form.role,
        isActive: form.isActive,
        birthDate: form.birthDate || undefined,
        address: form.address || undefined,
        maritalStatus: form.maritalStatus || undefined,
        emergencyContact: form.emergencyContact || undefined,
        notes: form.notes || undefined,
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

  function requestAvatarUpload(employeeId: string, file: File) {
    avatarMut.mutate({ id: employeeId, file });
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
          <Tooltip title={t("newEmployeeTooltip")} placement="left" arrow disableInteractive>
            <Button
              variant="contained"
              onClick={openCreate}
              sx={{ flexShrink: 0, minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
              aria-label={t("newEmployeeTooltip")}
            >
              <AddIcon />
            </Button>
          </Tooltip>
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
        departments={deptsQ.data ?? []}
        locations={locsQ.data ?? []}
        isPending={saveMut.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        onSubmit={() => saveMut.mutate()}
      />

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

function EmployeeFormDialog({
  open,
  fullScreen,
  editingId,
  form,
  setForm,
  departments,
  locations,
  isPending,
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
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();

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
            label={t("fullName")}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <TextField
            label={t("birthDate")}
            type="date"
            InputLabelProps={{ shrink: true }}
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
          />
          <TextField
            label={t("address")}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            sx={{ gridColumn: { sm: "1 / span 2" } }}
          />
          <TextField
            select
            label={t("maritalStatus")}
            value={form.maritalStatus}
            onChange={(e) => setForm({ ...form, maritalStatus: e.target.value as MaritalStatus | "" })}
          >
            <MenuItem value="">—</MenuItem>
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
            label={t("email")}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <TextField
            label={t("phone")}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <TextField
            label={editingId ? `${t("password")} (השאר ריק כדי לא לשנות)` : t("password")}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
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
            label={t("jobTitle")}
            value={form.jobTitle}
            onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
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
            select
            label={t("department")}
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <MenuItem value="">{t("noDepartment")}</MenuItem>
            {departments.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
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
          disabled={!form.fullName || !form.email || (!editingId && !form.password) || isPending}
          onClick={onSubmit}
        >
          {isPending ? t("loading") : t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
