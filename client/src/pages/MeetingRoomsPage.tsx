import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import RefreshIcon from "@mui/icons-material/Refresh";
import Autocomplete from "@mui/material/Autocomplete";
import {
  Alert,
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
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { locationsPickerUrl } from "../utils/referencePickerUrls";
import { useAuth, useRole } from "../store/authContext";
import type { Employee } from "../types/models";
import type {
  MeetingBookingPublic,
  MeetingMaterialPublic,
  MeetingRoomPublic,
} from "../types/meeting";
import { addDaysIsoLocal, todayIsoLocal } from "../utils/date";
import { apiErrorMessage } from "../utils/apiErrorMessage";

const CLIENT_MEETING_FILE_MAX_BYTES = 1_875_000;
const SERVER_MEETING_DATAURL_MAX_CHARS = 2_500_000;

const MEET_TAB_AVAILABILITY = 0;
const MEET_TAB_MANAGE = 1;

type LinkDraft = { kind: "link"; url: string; label: string };
type FileDraft = { kind: "file"; fileName: string; mimeType?: string; dataUrl: string };

function emptyBookingForm() {
  return {
    roomId: "",
    workDate: todayIsoLocal(),
    hourStart: "",
    hourEnd: "",
    title: "",
    inviteeIds: [] as string[],
    links: [{ kind: "link" as const, url: "", label: "" }],
    files: [] as FileDraft[],
  };
}

export default function MeetingRoomsPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const prefDate = searchParams.get("date") ?? "";

  const { user } = useAuth();
  const role = useRole();
  const isAdmin = role === "admin";

  const [tab, setTab] = useState(0);
  const [availabilityDate, setAvailabilityDate] = useState(() => todayIsoLocal());
  const [bookingPanelOpen, setBookingPanelOpen] = useState(false);
  const [inviteDialog, setInviteDialog] = useState<{ roomName: string; bookings: MeetingBookingPublic[] } | null>(
    null
  );
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [bookingSuccessBanner, setBookingSuccessBanner] = useState<string | null>(null);
  const [manageSuccessBanner, setManageSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === MEET_TAB_AVAILABILITY) setManageSuccessBanner(null);
    if (tab === MEET_TAB_MANAGE) setBookingSuccessBanner(null);
  }, [tab, isAdmin]);
  const [bookingForm, setBookingForm] = useState(emptyBookingForm);

  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [newRoomLoc, setNewRoomLoc] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomFloor, setNewRoomFloor] = useState("");
  const [newRoomCap, setNewRoomCap] = useState("8");

  const [editRoom, setEditRoom] = useState<MeetingRoomPublic | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomFloor, setEditRoomFloor] = useState("");
  const [editRoomCap, setEditRoomCap] = useState("");
  const [editRoomLoc, setEditRoomLoc] = useState("");

  const today = todayIsoLocal();
  const rangeTo = useMemo(() => addDaysIsoLocal(today, 90), [today]);

  const roomsQ = useQuery({
    queryKey: ["meeting-rooms"],
    queryFn: async () => (await api.get<{ items: MeetingRoomPublic[] }>("/api/meeting-rooms/rooms")).data.items,
    enabled: !!user,
  });

  const locationsQ = useQuery({
    queryKey: ["locations-for-meeting-admin"],
    queryFn: async () =>
      (await api.get<{ items: { id: string; name: string }[] }>(locationsPickerUrl())).data.items,
    enabled: !!user && isAdmin,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-for-meeting-invite"],
    queryFn: async () => {
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=100`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return all.filter((e) => e.isActive);
    },
    enabled: !!user && role !== null && (role === "employee" || role === "manager" || role === "admin"),
  });

  const bookingsQ = useQuery({
    queryKey: ["meeting-room-bookings", today, rangeTo],
    queryFn: async () =>
      (await api.get<{ items: MeetingBookingPublic[] }>(
        `/api/meeting-rooms/bookings?from=${today}&to=${rangeTo}`
      )).data.items,
    enabled: !!user,
  });

  const bookingEditQ = useQuery({
    queryKey: ["meeting-booking", editId],
    queryFn: async () => (await api.get<MeetingBookingPublic>(`/api/meeting-rooms/bookings/${editId}`)).data,
    enabled: !!user && !!editId,
  });

  const activeRooms = useMemo(
    () => (roomsQ.data ?? []).filter((r) => r.isActive),
    [roomsQ.data]
  );

  useEffect(() => {
    if (!prefDate || editId) return;
    setAvailabilityDate(prefDate);
    setBookingForm((p) => ({ ...p, workDate: prefDate }));
    setBookingPanelOpen(true);
  }, [prefDate, editId]);

  useEffect(() => {
    const b = bookingEditQ.data;
    if (!b) return;
    setAvailabilityDate(b.workDate);
    const links: LinkDraft[] = [];
    const files: FileDraft[] = [];
    for (const m of b.materials ?? []) {
      if (m.kind === "link") links.push({ kind: "link", url: m.url ?? "", label: m.label ?? "" });
      else files.push({ kind: "file", fileName: m.fileName, mimeType: m.mimeType, dataUrl: m.dataUrl });
    }
    if (links.length === 0) links.push({ kind: "link", url: "", label: "" });
    setBookingForm({
      roomId: b.roomId,
      workDate: b.workDate,
      hourStart: b.hourStart != null ? String(b.hourStart) : "",
      hourEnd: b.hourEnd != null ? String(b.hourEnd) : "",
      title: b.title,
      inviteeIds: (b.inviteeIds ?? []).filter((id) => id !== user?.id),
      links,
      files,
    });
  }, [bookingEditQ.data, user?.id]);

  const inviteeOptions = useMemo(() => {
    const orgId = bookingEditQ.data?.organizerId ?? user?.id;
    return (employeesQ.data ?? []).filter((e) => e.id !== orgId);
  }, [employeesQ.data, user?.id, bookingEditQ.data?.organizerId]);

  const selectedInvitees = useMemo(
    () => inviteeOptions.filter((e) => bookingForm.inviteeIds.includes(e.id)),
    [inviteeOptions, bookingForm.inviteeIds]
  );

  function buildMaterialsPayload(): MeetingMaterialPublic[] {
    const materials: MeetingMaterialPublic[] = [];
    for (const row of bookingForm.links) {
      const url = row.url.trim();
      if (!url) continue;
      materials.push({
        kind: "link",
        url,
        ...(row.label.trim() ? { label: row.label.trim() } : {}),
      });
    }
    for (const f of bookingForm.files) {
      materials.push({
        kind: "file",
        fileName: f.fileName,
        ...(f.mimeType ? { mimeType: f.mimeType } : {}),
        dataUrl: f.dataUrl,
      });
    }
    return materials;
  }

  function validateBookingPayload(): string | null {
    if (!bookingForm.roomId) return t("meetingErrRoomRequired");
    if (!bookingForm.workDate) return t("meetingErrDateRequired");
    if (!bookingForm.title.trim()) return t("meetingErrTitleRequired");
    const hs =
      bookingForm.hourStart.trim() === "" ? undefined : Number(bookingForm.hourStart);
    const he = bookingForm.hourEnd.trim() === "" ? undefined : Number(bookingForm.hourEnd);
    if (hs !== undefined && Number.isNaN(hs)) return t("meetingErrHoursInvalid");
    if (he !== undefined && Number.isNaN(he)) return t("meetingErrHoursInvalid");
    if (hs !== undefined && he !== undefined && hs >= he) return t("meetingErrHourOrder");
    const mats = buildMaterialsPayload();
    for (const m of mats) {
      if (m.kind === "file" && m.dataUrl.length > SERVER_MEETING_DATAURL_MAX_CHARS) {
        return t("meetingErrFileTooLarge");
      }
    }
    return null;
  }

  const createBookingMut = useMutation({
    mutationFn: async () => {
      const err = validateBookingPayload();
      if (err) throw new Error(err);
      const hs =
        bookingForm.hourStart.trim() === "" ? undefined : Number(bookingForm.hourStart);
      const he = bookingForm.hourEnd.trim() === "" ? undefined : Number(bookingForm.hourEnd);
      await api.post("/api/meeting-rooms/bookings", {
        roomId: bookingForm.roomId,
        workDate: bookingForm.workDate,
        hourStart: hs,
        hourEnd: he,
        title: bookingForm.title.trim(),
        inviteeIds: bookingForm.inviteeIds,
        materials: buildMaterialsPayload(),
      });
    },
    onSuccess: async () => {
      const msg = t("meetingBookingCreatedToast");
      setBookingSuccessBanner(msg);
      setToast({ msg, ok: true });
      setBookingForm(emptyBookingForm());
      await qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
      await qc.invalidateQueries({ queryKey: ["calendar-month"] });
      await qc.invalidateQueries({ queryKey: ["calendar-next7"] });
      await qc.invalidateQueries({ queryKey: ["calendar-day"] });
      navigate("/meeting-rooms", { replace: true });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const patchBookingMut = useMutation({
    mutationFn: async () => {
      const err = validateBookingPayload();
      if (err) throw new Error(err);
      const hsRaw = bookingForm.hourStart.trim();
      const heRaw = bookingForm.hourEnd.trim();
      const patch: Record<string, unknown> = {
        roomId: bookingForm.roomId,
        workDate: bookingForm.workDate,
        title: bookingForm.title.trim(),
        inviteeIds: bookingForm.inviteeIds,
        materials: buildMaterialsPayload(),
      };
      patch.hourStart = hsRaw === "" ? null : Number(hsRaw);
      patch.hourEnd = heRaw === "" ? null : Number(heRaw);
      await api.patch(`/api/meeting-rooms/bookings/${editId}`, patch);
    },
    onSuccess: async () => {
      const msg = t("meetingBookingUpdatedToast");
      setBookingSuccessBanner(msg);
      setBookingPanelOpen(true);
      setToast({ msg, ok: true });
      await qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
      await qc.invalidateQueries({ queryKey: ["meeting-booking", editId] });
      await qc.invalidateQueries({ queryKey: ["calendar-month"] });
      await qc.invalidateQueries({ queryKey: ["calendar-next7"] });
      await qc.invalidateQueries({ queryKey: ["calendar-day"] });
      navigate("/meeting-rooms", { replace: true });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const delBookingMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/meeting-rooms/bookings/${id}`),
    onSuccess: async () => {
      setToast({ msg: t("success"), ok: true });
      await qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
      navigate("/meeting-rooms", { replace: true });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const createRoomMut = useMutation({
    mutationFn: async () => {
      const cap = Number(newRoomCap);
      if (!newRoomLoc || !newRoomName.trim() || Number.isNaN(cap) || cap < 1) throw new Error(t("meetingErrRoomForm"));
      await api.post("/api/meeting-rooms/rooms", {
        locationId: newRoomLoc,
        name: newRoomName.trim(),
        floor: newRoomFloor.trim(),
        capacity: cap,
      });
    },
    onSuccess: async () => {
      const msg = t("meetingRoomCreatedToast");
      setManageSuccessBanner(msg);
      setToast({ msg, ok: true });
      setCreateRoomOpen(false);
      setNewRoomLoc("");
      setNewRoomName("");
      setNewRoomFloor("");
      setNewRoomCap("8");
      await qc.invalidateQueries({ queryKey: ["meeting-rooms"] });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const patchRoomMut = useMutation({
    mutationFn: async () => {
      if (!editRoom) return;
      const cap = Number(editRoomCap);
      if (!editRoomName.trim() || Number.isNaN(cap) || cap < 1) throw new Error(t("meetingErrRoomForm"));
      await api.patch(`/api/meeting-rooms/rooms/${editRoom.id}`, {
        locationId: editRoomLoc || editRoom.locationId,
        name: editRoomName.trim(),
        floor: editRoomFloor.trim(),
        capacity: cap,
      });
    },
    onSuccess: async () => {
      const msg = t("meetingRoomUpdatedToast");
      setManageSuccessBanner(msg);
      setToast({ msg, ok: true });
      setEditRoom(null);
      await qc.invalidateQueries({ queryKey: ["meeting-rooms"] });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const deactivateRoomMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/meeting-rooms/rooms/${id}`),
    onSuccess: async () => {
      const msg = t("meetingRoomDeactivatedToast");
      setManageSuccessBanner(msg);
      setToast({ msg, ok: true });
      await qc.invalidateQueries({ queryKey: ["meeting-rooms"] });
      await qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  async function onPickFile(file: File) {
    if (file.size > CLIENT_MEETING_FILE_MAX_BYTES) {
      setToast({ msg: t("meetingErrFileTooLarge"), ok: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (dataUrl.length > SERVER_MEETING_DATAURL_MAX_CHARS) {
        setToast({ msg: t("meetingErrFileTooLarge"), ok: false });
        return;
      }
      setBookingForm((p) => ({
        ...p,
        files: [
          ...p.files,
          {
            kind: "file",
            fileName: file.name,
            mimeType: file.type || undefined,
            dataUrl,
          },
        ],
      }));
    };
    reader.readAsDataURL(file);
  }

  const sortedBookings = useMemo(() => {
    const rows = [...(bookingsQ.data ?? [])];
    rows.sort((a, b) => (a.workDate === b.workDate ? a.title.localeCompare(b.title) : a.workDate.localeCompare(b.workDate)));
    return rows;
  }, [bookingsQ.data]);

  const bookingsOnAvailabilityDate = useMemo(
    () => (bookingsQ.data ?? []).filter((b) => b.workDate === availabilityDate),
    [bookingsQ.data, availabilityDate]
  );

  const bookingsByRoomIdOnDate = useMemo(() => {
    const m = new Map<string, MeetingBookingPublic[]>();
    for (const b of bookingsOnAvailabilityDate) {
      const arr = m.get(b.roomId) ?? [];
      arr.push(b);
      m.set(b.roomId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.hourStart ?? 0) - (b.hourStart ?? 0) || a.title.localeCompare(b.title));
    }
    return m;
  }, [bookingsOnAvailabilityDate]);

  const showBookingPanels = bookingPanelOpen || !!editId;

  const bookingPanelsStack = (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
            {editId ? t("meetingEditBookingTitle") : t("meetingBookCardTitle")}
          </Typography>
          {roomsQ.isError ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {apiErrorMessage(roomsQ.error, t("error"))}
            </Alert>
          ) : null}
          {employeesQ.isError ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {apiErrorMessage(employeesQ.error, t("error"))}
            </Alert>
          ) : null}
          {!roomsQ.isLoading && !roomsQ.isError && activeRooms.length === 0 ? (
            <Alert
              severity="warning"
              sx={{ mb: 1 }}
              action={
                isAdmin ? (
                  <Button color="inherit" size="small" onClick={() => setTab(MEET_TAB_MANAGE)}>
                    {t("meetingTabManage")}
                  </Button>
                ) : undefined
              }
            >
              {isAdmin ? (
                <>
                  {t("meetingNoRoomsHint")}
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {t("meetingNoRoomsHintAdmin")}
                  </Typography>
                </>
              ) : (
                t("meetingNoRoomsHintEmployee")
              )}
            </Alert>
          ) : null}
          <Stack spacing={1.5}>
            <TextField
              select
              label={t("meetingFieldRoom")}
              value={bookingForm.roomId}
              onChange={(e) => setBookingForm((p) => ({ ...p, roomId: e.target.value }))}
              required
              fullWidth
              disabled={(bookingEditQ.isFetching && !!editId) || activeRooms.length === 0}
              helperText={roomsQ.isLoading ? t("loading") : undefined}
            >
              {activeRooms.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} · {r.locationName}
                  {r.floor ? ` · ${t("meetingFieldFloor")} ${r.floor}` : ""}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label={t("meetingFieldDate")}
              value={bookingForm.workDate}
              onChange={(e) => setBookingForm((p) => ({ ...p, workDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label={t("meetingHourStart")}
                value={bookingForm.hourStart}
                onChange={(e) => setBookingForm((p) => ({ ...p, hourStart: e.target.value }))}
                helperText={t("meetingHoursHint")}
                fullWidth
              />
              <TextField
                label={t("meetingHourEnd")}
                value={bookingForm.hourEnd}
                onChange={(e) => setBookingForm((p) => ({ ...p, hourEnd: e.target.value }))}
                helperText={t("meetingHoursHint")}
                fullWidth
              />
            </Stack>
            <TextField
              label={t("meetingFieldTitle")}
              value={bookingForm.title}
              onChange={(e) => setBookingForm((p) => ({ ...p, title: e.target.value }))}
              fullWidth
              required
            />
            <Autocomplete
              multiple
              options={inviteeOptions}
              value={selectedInvitees}
              getOptionLabel={(o) => o.fullName}
              onChange={(_, v) => setBookingForm((p) => ({ ...p, inviteeIds: v.map((x) => x.id) }))}
              renderInput={(params) => <TextField {...params} label={t("meetingInviteesLabel")} />}
            />

            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" fontWeight={700}>
              {t("meetingMaterialsHeading")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("meetingMaterialsHint")}
            </Typography>
            {bookingForm.links.map((row, i) => (
              <Stack key={`link-${i}`} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <TextField
                  label={t("meetingLinkUrl")}
                  value={row.url}
                  onChange={(e) =>
                    setBookingForm((p) => {
                      const links = [...p.links];
                      links[i] = { ...links[i], url: e.target.value };
                      return { ...p, links };
                    })
                  }
                  fullWidth
                />
                <TextField
                  label={t("meetingLinkLabelOptional")}
                  value={row.label}
                  onChange={(e) =>
                    setBookingForm((p) => {
                      const links = [...p.links];
                      links[i] = { ...links[i], label: e.target.value };
                      return { ...p, links };
                    })
                  }
                  fullWidth
                />
                <IconButton
                  aria-label={t("delete")}
                  onClick={() =>
                    setBookingForm((p) => ({
                      ...p,
                      links: p.links.length > 1 ? p.links.filter((_, j) => j !== i) : [{ kind: "link", url: "", label: "" }],
                    }))
                  }
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setBookingForm((p) => ({ ...p, links: [...p.links, { kind: "link", url: "", label: "" }] }))}
            >
              {t("meetingAddLink")}
            </Button>

            <Button variant="outlined" component="label">
              {t("meetingAttachFile")}
              <input
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onPickFile(f);
                }}
              />
            </Button>
            {bookingForm.files.length > 0 ? (
              <Stack spacing={0.5}>
                {bookingForm.files.map((f, i) => (
                  <Stack key={`${f.fileName}-${i}`} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {f.fileName}
                    </Typography>
                    <IconButton
                      aria-label={t("delete")}
                      size="small"
                      onClick={() =>
                        setBookingForm((p) => ({
                          ...p,
                          files: p.files.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : null}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1 }}>
              {editId ? (
                <>
                  <Button variant="contained" onClick={() => patchBookingMut.mutate()} disabled={patchBookingMut.isPending || activeRooms.length === 0}>
                    {t("save")}
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => {
                      if (confirm(t("meetingConfirmDeleteBooking"))) delBookingMut.mutate(editId);
                    }}
                    disabled={delBookingMut.isPending}
                  >
                    {t("delete")}
                  </Button>
                </>
              ) : (
                <Button variant="contained" onClick={() => createBookingMut.mutate()} disabled={createBookingMut.isPending || activeRooms.length === 0}>
                  {t("meetingSubmitBooking")}
                </Button>
              )}
              {editId ? (
                <Button variant="text" onClick={() => navigate("/meeting-rooms", { replace: true })}>
                  {t("cancel")}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
            {t("meetingUpcomingTitle")}
          </Typography>
          {bookingsQ.isLoading ? (
            <Typography color="text.secondary">{t("loading")}</Typography>
          ) : sortedBookings.length === 0 ? (
            <Typography color="text.secondary">{t("meetingNoUpcoming")}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("meetingColWhen")}</TableCell>
                  <TableCell>{t("meetingColRoom")}</TableCell>
                  <TableCell>{t("meetingColTitle")}</TableCell>
                  <TableCell>{t("meetingColOrganizer")}</TableCell>
                  <TableCell sx={{ textAlign: "end" }}>{t("meetingColActions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedBookings.map((b) => {
                  const hours =
                    b.hourStart != null || b.hourEnd != null
                      ? `${b.hourStart ?? "—"}–${b.hourEnd ?? "—"}`
                      : t("meetingFullDay");
                  const canEdit = user?.role === "admin" || b.organizerId === user?.id;
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Typography variant="body2" component="span" lang="en" sx={{ direction: "ltr", unicodeBidi: "plaintext" }}>
                          {b.workDate}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {hours}
                        </Typography>
                      </TableCell>
                      <TableCell>{b.roomName}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>{b.title}</TableCell>
                      <TableCell>{b.organizerName}</TableCell>
                      <TableCell sx={{ textAlign: "end" }}>
                        {canEdit ? (
                          <Button size="small" onClick={() => navigate(`/meeting-rooms?edit=${encodeURIComponent(b.id)}`)}>
                            {t("meetingEdit")}
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );

  function meetingBookingHoursCompact(b: MeetingBookingPublic): string {
    if (b.hourStart != null || b.hourEnd != null) return `${b.hourStart ?? "—"}–${b.hourEnd ?? "—"}`;
    return t("meetingFullDay");
  }

  const availabilityTab = (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
            {t("meetingAvailabilityTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t("meetingAvailabilityHint")}
          </Typography>
          <TextField
            type="date"
            label={t("meetingAvailabilityDateLabel")}
            value={availabilityDate}
            onChange={(e) => setAvailabilityDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            inputProps={{ min: today, max: rangeTo }}
            sx={{ maxWidth: 280 }}
          />
        </CardContent>
      </Card>

      {roomsQ.isLoading || bookingsQ.isLoading ? (
        <Typography color="text.secondary">{t("loading")}</Typography>
      ) : activeRooms.length === 0 ? (
        <Alert severity={isAdmin ? "warning" : "info"} sx={{ "& .MuiAlert-message": { width: "100%" } }}>
          {isAdmin ? (
            <>
              <Typography variant="body2">{t("meetingNoRoomsHint")}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t("meetingNoRoomsHintAdmin")}
              </Typography>
              <Button size="small" sx={{ mt: 1 }} onClick={() => setTab(MEET_TAB_MANAGE)}>
                {t("meetingTabManage")}
              </Button>
            </>
          ) : (
            <Typography variant="body2">{t("meetingNoRoomsHintEmployee")}</Typography>
          )}
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
          }}
        >
          {[...activeRooms].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
            const rb = bookingsByRoomIdOnDate.get(r.id) ?? [];
            const busy = rb.length > 0;
            const ocBg = alpha("#c62828", theme.palette.mode === "dark" ? 0.22 : 0.1);
            const ocBd = alpha("#c62828", theme.palette.mode === "dark" ? 0.55 : 0.45);
            const frBg = alpha("#2e7d32", theme.palette.mode === "dark" ? 0.2 : 0.09);
            const frBd = alpha("#2e7d32", theme.palette.mode === "dark" ? 0.52 : 0.42);

            const cardBody = (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 800, wordBreak: "break-word", flex: 1 }}>
                    {r.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={busy ? t("meetingRoomStatusOccupied") : t("meetingRoomStatusFree")}
                    sx={{
                      bgcolor: busy ? alpha("#c62828", 0.14) : alpha("#2e7d32", 0.13),
                      color: busy ? "#b71c1c" : "#1b5e20",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  {r.locationName}
                  {r.floor ? ` · ${t("meetingFieldFloor")} ${r.floor}` : ""}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  lang="en"
                  sx={{ direction: "ltr", unicodeBidi: "plaintext", mb: 0.75, fontWeight: 600 }}
                >
                  {availabilityDate}
                </Typography>
                {busy ? (
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.35 }}>
                      {meetingBookingHoursCompact(rb[0]!)} · {rb[0]!.organizerName}
                    </Typography>
                    {rb.length > 1 ? (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        {t("meetingAvailabilityMoreSameDay", { count: rb.length - 1 })}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                      {t("meetingRoomTapInvitees")}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.35 }}>
                      {t("meetingRoomFreeCaption")}
                    </Typography>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                      {t("meetingRoomTapToBook")}
                    </Typography>
                  </>
                )}
              </>
            );

            return (
              <Card
                key={r.id}
                variant="outlined"
                sx={{
                  borderWidth: 2,
                  bgcolor: busy ? ocBg : frBg,
                  borderColor: busy ? ocBd : frBd,
                }}
              >
                <CardActionArea
                  onClick={() => {
                    if (busy) setInviteDialog({ roomName: r.name, bookings: rb });
                    else {
                      setBookingForm({
                        ...emptyBookingForm(),
                        roomId: r.id,
                        workDate: availabilityDate,
                      });
                      setBookingPanelOpen(true);
                    }
                  }}
                  sx={{ height: "100%" }}
                  aria-label={busy ? `${r.name}: ${t("meetingRoomTapInvitees")}` : `${r.name}: ${t("meetingRoomTapToBook")}`}
                >
                  <CardContent sx={{ minHeight: 152 }}>{cardBody}</CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      )}
      {showBookingPanels ? (
        <Stack spacing={1}>
          {bookingPanelOpen && !editId ? (
            <Button
              size="small"
              variant="text"
              sx={{ alignSelf: "flex-start" }}
              onClick={() => {
                setBookingPanelOpen(false);
                setBookingForm(emptyBookingForm());
              }}
            >
              {t("meetingBookingHideForm")}
            </Button>
          ) : null}
          {bookingPanelsStack}
        </Stack>
      ) : null}
    </Stack>
  );

  const manageTab = (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
          <Typography variant="subtitle1" fontWeight={800}>
            {t("meetingRoomsManageTitle")}
          </Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateRoomOpen(true)}>
            {t("meetingAddRoom")}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("meetingRoomsDeactivateHint")}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("meetingColRoom")}</TableCell>
              <TableCell>{t("locations")}</TableCell>
              <TableCell>{t("meetingFieldFloor")}</TableCell>
              <TableCell>{t("meetingFieldCapacity")}</TableCell>
              <TableCell>{t("meetingColActive")}</TableCell>
              <TableCell sx={{ textAlign: "end" }}>{t("meetingColActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(roomsQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.locationName}</TableCell>
                <TableCell>{r.floor || "—"}</TableCell>
                <TableCell>{r.capacity}</TableCell>
                <TableCell>{r.isActive ? <Chip size="small" color="success" label={t("meetingActiveYes")} /> : <Chip size="small" label={t("meetingActiveNo")} />}</TableCell>
                <TableCell sx={{ textAlign: "end" }}>
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Button
                      size="small"
                      onClick={() => {
                        setEditRoom(r);
                        setEditRoomName(r.name);
                        setEditRoomFloor(r.floor);
                        setEditRoomCap(String(r.capacity));
                        setEditRoomLoc(r.locationId);
                      }}
                    >
                      {t("meetingEdit")}
                    </Button>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      disabled={!r.isActive}
                      onClick={() => {
                        if (confirm(t("meetingConfirmDeactivate"))) deactivateRoomMut.mutate(r.id);
                      }}
                    >
                      {t("meetingDeactivate")}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 960, mx: "auto", pb: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <MeetingRoomIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2rem" }, flex: 1 }}>
          {t("meetingRooms")}
        </Typography>
        <IconButton
          onClick={() => {
            void qc.invalidateQueries({ queryKey: ["meeting-rooms"] });
            void qc.invalidateQueries({ queryKey: ["meeting-room-bookings"] });
          }}
          aria-label={t("parkingRefresh")}
        >
          <RefreshIcon />
        </IconButton>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("meetingRoomsIntro")}
      </Typography>

      {isAdmin ? (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label={t("meetingTabAvailability")} />
          <Tab label={t("meetingTabManage")} />
        </Tabs>
      ) : null}

      {bookingSuccessBanner && (!isAdmin || tab === MEET_TAB_AVAILABILITY) ? (
        <Alert severity="success" onClose={() => setBookingSuccessBanner(null)} sx={{ mb: 2 }}>
          {bookingSuccessBanner}
        </Alert>
      ) : null}
      {manageSuccessBanner && isAdmin && tab === MEET_TAB_MANAGE ? (
        <Alert severity="success" onClose={() => setManageSuccessBanner(null)} sx={{ mb: 2 }}>
          {manageSuccessBanner}
        </Alert>
      ) : null}

      {!isAdmin || tab === MEET_TAB_AVAILABILITY ? availabilityTab : null}
      {isAdmin && tab === MEET_TAB_MANAGE ? manageTab : null}

      <Dialog open={createRoomOpen} onClose={() => setCreateRoomOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("meetingAddRoom")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select label={t("locations")} value={newRoomLoc} onChange={(e) => setNewRoomLoc(e.target.value)} fullWidth required>
              {(locationsQ.data ?? []).map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={t("meetingFieldRoomName")} value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} fullWidth required />
            <TextField label={t("meetingFieldFloor")} value={newRoomFloor} onChange={(e) => setNewRoomFloor(e.target.value)} fullWidth />
            <TextField label={t("meetingFieldCapacity")} value={newRoomCap} onChange={(e) => setNewRoomCap(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateRoomOpen(false)}>{t("cancel")}</Button>
          <Button variant="contained" onClick={() => createRoomMut.mutate()} disabled={createRoomMut.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editRoom} onClose={() => setEditRoom(null)} fullWidth maxWidth="sm">
        <DialogTitle>{t("meetingEditRoomTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select label={t("locations")} value={editRoomLoc} onChange={(e) => setEditRoomLoc(e.target.value)} fullWidth required>
              {(locationsQ.data ?? []).map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={t("meetingFieldRoomName")} value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} fullWidth required />
            <TextField label={t("meetingFieldFloor")} value={editRoomFloor} onChange={(e) => setEditRoomFloor(e.target.value)} fullWidth />
            <TextField label={t("meetingFieldCapacity")} value={editRoomCap} onChange={(e) => setEditRoomCap(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoom(null)}>{t("cancel")}</Button>
          <Button variant="contained" onClick={() => patchRoomMut.mutate()} disabled={patchRoomMut.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={inviteDialog !== null} onClose={() => setInviteDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{inviteDialog?.roomName}</DialogTitle>
        <DialogContent dividers>
          {(inviteDialog?.bookings ?? []).map((b, idx, arr) => (
            <Box key={b.id}>
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                {b.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                lang="en"
                sx={{ direction: "ltr", unicodeBidi: "plaintext", mb: 0.75 }}
              >
                {b.workDate} · {meetingBookingHoursCompact(b)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t("meetingColOrganizer")}: {b.organizerName}
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {t("meetingInviteesHeading")}
              </Typography>
              {b.invitees?.length ? (
                <List dense disablePadding>
                  {b.invitees.map((i) => (
                    <ListItem key={i.id} disablePadding sx={{ py: 0.25 }}>
                      <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={i.fullName} />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t("meetingInviteesDialogEmpty")}
                </Typography>
              )}
              {idx < arr.length - 1 ? <Divider sx={{ my: 2 }} /> : null}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialog(null)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.ok ? 6500 : 8000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setToast(null)} severity={toast?.ok ? "success" : "error"} variant="filled" sx={{ width: "100%" }}>
          {toast?.msg ?? ""}
        </Alert>
      </Snackbar>
    </Box>
  );
}
