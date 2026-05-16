import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Link,
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
import LocationsIcon from "@mui/icons-material/Place";
import EditIcon from "@mui/icons-material/EditOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/AddCircle";
import PeopleIcon from "@mui/icons-material/People";
import LocationCityIcon from "@mui/icons-material/LocationCity";
import MapIcon from "@mui/icons-material/Map";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { useRole } from "../store/authContext";

interface Loc {
  id: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  capacity: number;
  isActive: boolean;
}

type FormState = { name: string; city: string; country: string; address: string; capacity: number };

/** Build a single search string for map providers (address first, then context). */
function buildLocationMapQuery(l: Pick<Loc, "name" | "city" | "country" | "address">): string {
  const parts = [l.address, l.city, l.country, l.name].map((x) => (x ?? "").trim()).filter(Boolean);
  return [...new Set(parts)].join(", ");
}

export default function LocationsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const qc = useQueryClient();
  const role = useRole();
  const canWrite = role === "admin";
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", city: "", country: "", address: "", capacity: 50 });

  const q = useQuery({
    queryKey: ["locations"],
    queryFn: async () => (await api.get<{ items: Loc[] }>("/api/locations")).data,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        city: form.city || undefined,
        country: form.country || undefined,
        address: form.address || undefined,
        capacity: Number(form.capacity),
      };
      if (editingId) return api.put(`/api/locations/${editingId}`, payload);
      return api.post("/api/locations", payload);
    },
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      setOpen(false);
      setEditingId(null);
      setForm({ name: "", city: "", country: "", address: "", capacity: 50 });
      await qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/locations/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      await qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (err) => setToast({ msg: apiErrorMessage(err, t("error")), ok: false }),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", city: "", country: "", address: "", capacity: 50 });
    setOpen(true);
  }

  function openEdit(l: Loc) {
    setEditingId(l.id);
    setForm({
      name: l.name,
      city: l.city ?? "",
      country: l.country ?? "",
      address: l.address ?? "",
      capacity: l.capacity,
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
          <LocationsIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("locations")}
          </Typography>
          <Chip size="small" label={`${q.data?.items?.length ?? 0} ${t("total")}`} />
        </Stack>
        {canWrite && (
          <Tooltip title={t("newLocationTooltip")} placement="left" arrow disableInteractive>
            <Button
              variant="contained"
              onClick={openCreate}
              sx={{ flexShrink: 0, minWidth: 44, px: 1.25, py: 1, borderRadius: 999 }}
              aria-label={t("newLocationTooltip")}
            >
              <AddIcon />
            </Button>
          </Tooltip>
        )}
      </Stack>

      <Stack sx={{ mb: 2.5, maxWidth: 800, gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t("locationsPagePurpose")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("locationsPageUpdateImportance")}
        </Typography>
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
            <Skeleton key={i} variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : (q.data?.items?.length ?? 0) === 0 ? (
        <EmptyState onAdd={openCreate} canAdd={canWrite} />
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
          {q.data!.items.map((l) => {
            const fillPct = l.capacity > 0 ? Math.min(100, Math.round((l.capacity / 200) * 100)) : 0;
            const mapQ = buildLocationMapQuery(l);
            const mapsEmbedSrc = mapQ
              ? `https://www.google.com/maps?q=${encodeURIComponent(mapQ)}&hl=iw&z=16&output=embed`
              : "";
            const osmSearchHref = mapQ
              ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(mapQ)}`
              : "";

            return (
              <Card
                key={l.id}
                className="syt-lift"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  pr: 1,
                }}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5, minWidth: 0 }}>
                    <Avatar
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.16),
                        color: "secondary.main",
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                      }}
                    >
                      <LocationsIcon />
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, wordBreak: "break-word" }}>
                        {l.name}
                      </Typography>
                      {l.city && (
                        <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ mt: 0.25, minWidth: 0 }}>
                          <LocationCityIcon sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0, mt: 0.1 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                            {l.city}
                            {l.country ? `, ${l.country}` : ""}
                          </Typography>
                        </Stack>
                      )}
                      {l.address && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, wordBreak: "break-word" }}>
                          {l.address}
                        </Typography>
                      )}
                    </Box>
                    <Chip
                      size="small"
                      label={l.isActive ? t("active") : t("inactive")}
                      color={l.isActive ? "success" : "default"}
                      sx={{ flexShrink: 0 }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <PeopleIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                    <Typography variant="body2" color="text.secondary">
                      {t("capacity")}:
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {l.capacity}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={fillPct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.secondary.main, 0.1),
                      "& .MuiLinearProgress-bar": { bgcolor: "secondary.main" },
                    }}
                  />

                  {mapQ ? (
                    <Box sx={{ mt: 1.5 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                        <MapIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          {t("locationMapPreview")}
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          height: 168,
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "action.hover",
                        }}
                      >
                        <iframe
                          title={`${t("locationMapPreview")}: ${l.name}`}
                          width="100%"
                          height="100%"
                          style={{ border: 0, display: "block" }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={mapsEmbedSrc}
                        />
                      </Box>
                      <Link href={osmSearchHref} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ mt: 0.75, display: "inline-block" }}>
                        {t("openMapExternally")}
                      </Link>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 1.5 }}>
                      {t("locationMapNoAddress")}
                    </Typography>
                  )}
                </CardContent>
                {canWrite && (
                  <CardActions sx={{ justifyContent: "flex-end", pb: 1.5, pl: 2 }}>
                    <Tooltip title={t("edit")} arrow>
                      <IconButton color="primary" onClick={() => openEdit(l)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("delete")} arrow>
                      <IconButton
                        color="error"
                        onClick={() => {
                          if (confirm(`למחוק את "${l.name}"?`)) deleteMut.mutate(l.id);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                )}
              </Card>
            );
          })}
        </Box>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>

      {canWrite && (
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={isXs}>
          <DialogTitle>{editingId ? t("edit") : t("newLocation")}</DialogTitle>
          <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="שם"
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label={t("locationAddressField")}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              multiline
              minRows={2}
              helperText={t("locationAddressMapHint")}
            />
            <TextField label={t("city")} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField
              label={t("country")}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              placeholder={t("countryPlaceholder")}
            />
            <TextField
              label={t("capacity")}
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="contained"
              disabled={saveMut.isPending || !form.name.trim() || form.capacity <= 0}
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

function EmptyState({ onAdd, canAdd }: { onAdd: () => void; canAdd: boolean }) {
  return (
    <Card sx={{ textAlign: "center", p: 4 }}>
      <LocationsIcon sx={{ fontSize: 64, color: "text.disabled", mb: 1 }} />
      <Typography variant="h6" gutterBottom>
        אין מיקומים עדיין
      </Typography>
      {canAdd && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} sx={{ mt: 2 }}>
          הוספת מיקום ראשון
        </Button>
      )}
    </Card>
  );
}
