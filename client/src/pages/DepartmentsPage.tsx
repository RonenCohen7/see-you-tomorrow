import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DepartmentsIcon from "@mui/icons-material/Apartment";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/AddCircle";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { TFunction } from "i18next";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { fileToResizedJpegDataUrl } from "../utils/imageResize";
import { useRole } from "../store/authContext";

interface Dept {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  accentColor?: string;
  locationId?: string;
  isActive: boolean;
}

type FormState = { name: string; description: string; imageUrl: string; accentColor: string };

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const qc = useQueryClient();
  const role = useRole();
  const canWrite = role === "admin";
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", description: "", imageUrl: "", accentColor: "" });
  const [activeOnly, setActiveOnly] = useState(true);

  const q = useQuery({
    queryKey: ["departments", activeOnly],
    queryFn: async () => {
      const qs = activeOnly ? "?isActive=true" : "";
      return (await api.get<{ items: Dept[] }>(`/api/departments${qs}`)).data;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: { name: string; description?: string; imageUrl?: string; accentColor?: string } = {
        name: form.name,
        description: form.description || undefined,
      };
      const trimmed = form.imageUrl.trim();
      if (trimmed) payload.imageUrl = trimmed;
      const ac = form.accentColor.trim();
      if (ac) payload.accentColor = ac;
      else if (editingId) payload.accentColor = "";
      if (editingId) return api.put(`/api/departments/${editingId}`, payload);
      return api.post("/api/departments", payload);
    },
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      setOpen(false);
      setEditingId(null);
      setForm({ name: "", description: "", imageUrl: "", accentColor: "" });
      await qc.invalidateQueries({ queryKey: ["departments"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-emp"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-ai"] });
      await qc.invalidateQueries({ queryKey: ["departments-ai-queue"] });
      await qc.invalidateQueries({ queryKey: ["departments-team-prefs"] });
      await qc.invalidateQueries({ queryKey: ["department-by-id-ai-fallback"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/departments/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("departmentsSoftDeletedToast"), ok: true });
      await qc.invalidateQueries({ queryKey: ["departments"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-emp"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-ai"] });
      await qc.invalidateQueries({ queryKey: ["departments-ai-queue"] });
      await qc.invalidateQueries({ queryKey: ["departments-team-prefs"] });
      await qc.invalidateQueries({ queryKey: ["department-by-id-ai-fallback"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const activateDeptMut = useMutation({
    mutationFn: async (id: string) => api.put(`/api/departments/${id}`, { isActive: true }),
    onSuccess: async () => {
      setToast({ msg: t("departmentActivatedToast"), ok: true });
      await qc.invalidateQueries({ queryKey: ["departments"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-emp"] });
      await qc.invalidateQueries({ queryKey: ["departments-for-ai"] });
      await qc.invalidateQueries({ queryKey: ["departments-ai-queue"] });
      await qc.invalidateQueries({ queryKey: ["departments-team-prefs"] });
      await qc.invalidateQueries({ queryKey: ["department-by-id-ai-fallback"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });
  const avatarMut = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const imageUrl = await fileToResizedJpegDataUrl(file);
      return (await api.put<Dept>(`/api/departments/${id}`, { imageUrl })).data;
    },
    onSuccess: () => {
      setToast({ msg: t("success"), ok: true });
      void qc.invalidateQueries({ queryKey: ["departments"] });
      void qc.invalidateQueries({ queryKey: ["departments-for-emp"] });
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

  function requestDeptAvatarUpload(departmentId: string, file: File) {
    avatarMut.mutate({ id: departmentId, file });
  }

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", description: "", imageUrl: "", accentColor: "" });
    setOpen(true);
  }

  function openEdit(d: Dept) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description ?? "",
      imageUrl: d.imageUrl && !d.imageUrl.startsWith("data:") ? d.imageUrl : "",
      accentColor: d.accentColor && /^#[0-9A-Fa-f]{6}$/i.test(d.accentColor) ? d.accentColor : "",
    });
    setOpen(true);
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Stack
        direction="row"
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3, flexWrap: "wrap", gap: 1.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <DepartmentsIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("departments")}
          </Typography>
          <Chip size="small" label={`${q.data?.items?.length ?? 0} ${t("total")}`} />
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch
              checked={activeOnly}
              onChange={(_, c) => setActiveOnly(c)}
              size="small"
              id="departments-active-only"
            />
            <Typography component="label" htmlFor="departments-active-only" variant="body2" sx={{ cursor: "pointer" }}>
              {t("activeOnly")}
            </Typography>
          </Stack>
          {canWrite && (
            <Tooltip title={t("newDepartmentTooltip")} placement="left" arrow disableInteractive>
              <Button
                variant="contained"
                onClick={openCreate}
                sx={{ flexShrink: 0, minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
                aria-label={t("newDepartmentTooltip")}
              >
                <AddIcon />
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {q.isLoading ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              sm: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              md: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            },
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : (q.data?.items?.length ?? 0) === 0 ? (
        activeOnly ? (
          <Card sx={{ textAlign: "center", p: 4 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {t("departmentsNoActiveMatch")}
            </Typography>
            <Button variant="outlined" onClick={() => setActiveOnly(false)}>
              {t("departmentsShowAll")}
            </Button>
          </Card>
        ) : (
          <EmptyState onAdd={openCreate} canAdd={canWrite} />
        )
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              sm: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              md: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
            },
          }}
        >
          {q.data!.items.map((d) => (
            <DepartmentCard
              key={d.id}
              dept={d}
              canWrite={canWrite}
              avatarUploading={avatarMut.isPending && avatarMut.variables?.id === d.id}
              onAvatarUpload={(file) => requestDeptAvatarUpload(d.id, file)}
              onEdit={() => openEdit(d)}
              onDelete={() => {
                if (window.confirm(t("departmentsDeleteConfirm", { name: d.name }))) deleteMut.mutate(d.id);
              }}
              deletePending={deleteMut.isPending && deleteMut.variables === d.id}
              onActivate={() => activateDeptMut.mutate(d.id)}
              activatePending={activateDeptMut.isPending && activateDeptMut.variables === d.id}
              t={t}
            />
          ))}
        </Box>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      {canWrite && (
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={isXs}>
          <DialogTitle>{editingId ? t("edit") : t("newDepartment")}</DialogTitle>
          <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="שם"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label={t("description")}
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label={t("imageUrlOptional")}
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://… או השאר ריק והעלה מהכרטיס"
              helperText={t("departmentImageUrlHint")}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
              <Typography component="label" htmlFor="dept-accent-color" sx={{ minWidth: 100 }}>
                {t("departmentAccentColor")}
              </Typography>
              <input
                id="dept-accent-color"
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/i.test(form.accentColor) ? form.accentColor : "#7c4dff"}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                style={{ width: 56, height: 40, border: "none", cursor: "pointer", borderRadius: 8 }}
              />
              <TextField
                size="small"
                label="Hex"
                placeholder="#7C4DFF"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                sx={{ flex: 1, minWidth: 120 }}
                helperText={t("departmentAccentColorHint")}
              />
              <Button size="small" onClick={() => setForm({ ...form, accentColor: "" })}>
                {t("departmentAccentColorClear")}
              </Button>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="contained"
              disabled={saveMut.isPending || !form.name.trim()}
              onClick={() => saveMut.mutate()}
            >
              {saveMut.isPending ? t("loading") : t("save")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

function DepartmentCard({
  dept,
  canWrite,
  avatarUploading,
  onAvatarUpload,
  onEdit,
  onDelete,
  deletePending,
  onActivate,
  activatePending,
  t,
}: {
  dept: Dept;
  canWrite: boolean;
  avatarUploading: boolean;
  onAvatarUpload: (file: File) => void;
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
  onActivate: () => void;
  activatePending: boolean;
  t: TFunction;
}) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card
      className="syt-lift"
      sx={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          height: 6,
          background: dept.accentColor
            ? `linear-gradient(90deg, ${dept.accentColor}, ${alpha(dept.accentColor, 0.45)})`
            : `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.4)})`,
        }}
      />
      <CardContent sx={{ flexGrow: 1, textAlign: "center", pb: 1 }}>
        <Box sx={{ position: "relative", width: 72, height: 72, mx: "auto", mb: 1.5 }}>
          <Avatar
            src={dept.imageUrl || undefined}
            sx={{
              width: 72,
              height: 72,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: "primary.main",
              fontWeight: 700,
              fontSize: 28,
              border: `2px solid ${alpha(theme.palette.primary.main, 0.25)}`,
              opacity: avatarUploading ? 0.55 : 1,
            }}
          >
            {!dept.imageUrl ? <DepartmentsIcon sx={{ fontSize: 36 }} /> : dept.name.charAt(0)}
          </Avatar>
          {avatarUploading && (
            <CircularProgress
              size={44}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                marginTop: "-22px",
                marginLeft: "-22px",
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
              <Tooltip title={t("uploadDepartmentPhoto")} arrow>
                <IconButton
                  type="button"
                  size="small"
                  disabled={avatarUploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  sx={{
                    position: "absolute",
                    bottom: -2,
                    insetInlineEnd: -2,
                    bgcolor: "background.paper",
                    boxShadow: 1,
                    width: 28,
                    height: 28,
                  }}
                  aria-label={t("uploadDepartmentPhoto")}
                >
                  <PhotoCameraIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, wordBreak: "break-word" }}>
          {dept.name}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            minHeight: 48,
            fontStyle: dept.description ? "normal" : "italic",
            px: 1,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          {dept.description?.trim() || t("noDescription")}
        </Typography>
        <Stack direction="column" alignItems="center" spacing={1} sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            label={dept.isActive ? t("active") : t("inactive")}
            color={dept.isActive ? "success" : "default"}
          />
          {canWrite && !dept.isActive ? (
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={onActivate}
              disabled={activatePending}
              startIcon={
                activatePending ? <CircularProgress color="inherit" size={14} sx={{ mr: -0.5 }} /> : undefined
              }
            >
              {t("activate")}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
      {canWrite && (
        <CardActions sx={{ justifyContent: "center", pb: 1.5 }}>
          <Tooltip title={t("edit")} arrow>
            <IconButton color="primary" onClick={onEdit}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          {dept.isActive ? (
            <Tooltip title={t("delete")} arrow>
              <IconButton color="error" onClick={onDelete} disabled={deletePending}>
                {deletePending ? <CircularProgress size={22} color="inherit" /> : <DeleteIcon />}
              </IconButton>
            </Tooltip>
          ) : null}
        </CardActions>
      )}
    </Card>
  );
}

function EmptyState({ onAdd, canAdd }: { onAdd: () => void; canAdd: boolean }) {
  return (
    <Card sx={{ textAlign: "center", p: 4 }}>
      <DepartmentsIcon sx={{ fontSize: 64, color: "text.disabled", mb: 1 }} />
      <Typography variant="h6" gutterBottom>
        אין מחלקות עדיין
      </Typography>
      {canAdd && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ mt: 2 }}>
          הוספת מחלקה ראשונה
        </Button>
      )}
    </Card>
  );
}
