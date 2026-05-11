import LocalParkingIcon from "@mui/icons-material/LocalParking";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useAuth, useRole } from "../store/authContext";
import type { Employee } from "../types/models";
import { addDaysIsoLocal, todayIsoLocal } from "../utils/date";
import type { ParkingReservationPublic, ParkingSpotPublic } from "../utils/parkingSmartAlerts";

export default function ParkingManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = useRole();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canManageSpots = isAdmin;
  const canAssign = isAdmin || isManager || role === "employee";
  const today = todayIsoLocal();
  const rangeTo = useMemo(() => addDaysIsoLocal(today, 21), [today]);

  const [seedLoc, setSeedLoc] = useState("");
  const [resOpen, setResOpen] = useState(false);
  const [spotId, setSpotId] = useState("");
  const [empId, setEmpId] = useState("");
  const [workDate, setWorkDate] = useState(today);
  const [hourStart, setHourStart] = useState("");
  const [hourEnd, setHourEnd] = useState("");

  const locationsQ = useQuery({
    queryKey: ["locations-for-parking"],
    queryFn: async () => (await api.get<{ items: { id: string; name: string }[] }>("/api/locations")).data.items,
    enabled: isAdmin,
  });

  const spotsQ = useQuery({
    queryKey: ["parking-spots"],
    queryFn: async () => (await api.get<{ items: ParkingSpotPublic[] }>("/api/parking/spots")).data.items,
  });

  const resQ = useQuery({
    queryKey: ["parking-reservations", today, rangeTo],
    queryFn: async () =>
      (await api.get<{ items: ParkingReservationPublic[] }>(`/api/parking/reservations?from=${today}&to=${rangeTo}`))
        .data.items,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-for-parking"],
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
      return all;
    },
    enabled: isAdmin || isManager,
  });

  const spotById = useMemo(() => new Map((spotsQ.data ?? []).map((s) => [s.id, s])), [spotsQ.data]);

  const employeesForUi = useMemo(() => {
    if (role === "employee" && user) return [user];
    return employeesQ.data ?? [];
  }, [role, user, employeesQ.data]);

  useEffect(() => {
    if (resOpen && role === "employee" && user) setEmpId(user.id);
  }, [resOpen, role, user]);

  const seedMut = useMutation({
    mutationFn: async (locationId: string) => api.post("/api/parking/spots/seed-ten", { locationId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parking-spots"] });
    },
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, assignedEmployeeId }: { id: string; assignedEmployeeId: string | null }) =>
      api.patch(`/api/parking/spots/${id}`, { assignedEmployeeId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parking-spots"] });
    },
  });

  const createResMut = useMutation({
    mutationFn: async () =>
      api.post("/api/parking/reservations", {
        spotId,
        employeeId: empId,
        workDate,
        hourStart: hourStart === "" ? undefined : Number(hourStart),
        hourEnd: hourEnd === "" ? undefined : Number(hourEnd),
      }),
    onSuccess: async () => {
      setResOpen(false);
      setSpotId("");
      setEmpId("");
      setHourStart("");
      setHourEnd("");
      await qc.invalidateQueries({ queryKey: ["parking-reservations"] });
      await qc.invalidateQueries({ queryKey: ["schedules-forward-parking"] });
      await qc.invalidateQueries({ queryKey: ["schedules-recent"] });
      await qc.invalidateQueries({ queryKey: ["schedules-recent"] });
      await qc.invalidateQueries({ queryKey: ["employees-all-for-ai"] });
    },
  });

  const delResMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/parking/reservations/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["parking-reservations"] });
      await qc.invalidateQueries({ queryKey: ["schedules-forward-parking"] });
      await qc.invalidateQueries({ queryKey: ["schedules-recent"] });
    },
  });

  if (role === null) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {role === "employee" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
          {t("parkingEmployeeHint")}
        </Typography>
      )}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1, flexWrap: "wrap" }}>
        <LocalParkingIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
          {t("parking")}
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          size="small"
          onClick={() => {
            void spotsQ.refetch();
            void resQ.refetch();
          }}
        >
          {t("parkingRefresh")}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        {t("parkingSubtitle")}
      </Typography>

      {canManageSpots && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              {t("parkingSeedTitle")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
              <TextField
                select
                label={t("locations")}
                value={seedLoc}
                onChange={(e) => setSeedLoc(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                {(locationsQ.data ?? []).map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                disabled={!seedLoc || seedMut.isPending}
                onClick={() => seedMut.mutate(seedLoc)}
              >
                {t("parkingSeedTen")}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            {t("parkingSpotsTitle")}
          </Typography>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("parkingColLabel")}</TableCell>
                  <TableCell>{t("locations")}</TableCell>
                  <TableCell>{t("parkingColFixed")}</TableCell>
                  {canManageSpots && <TableCell>{t("parkingColAssign")}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {(spotsQ.data ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.label}</TableCell>
                    <TableCell>{s.locationName}</TableCell>
                    <TableCell>
                      {s.assignedEmployeeId
                        ? employeesForUi.find((e) => e.id === s.assignedEmployeeId)?.fullName ??
                          (role === "employee"
                            ? s.assignedEmployeeId === user?.id
                              ? t("parkingYou")
                              : t("parkingOtherHolder")
                            : "—")
                        : "—"}
                    </TableCell>
                    {canManageSpots && (
                      <TableCell sx={{ minWidth: 200 }}>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={s.assignedEmployeeId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            void patchMut.mutateAsync({
                              id: s.id,
                              assignedEmployeeId: v === "" ? null : v,
                            });
                          }}
                        >
                          <MenuItem value="">—</MenuItem>
                          {(employeesQ.data ?? []).map((e) => (
                            <MenuItem key={e.id} value={e.id}>
                              {e.fullName}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {t("parkingResTitle")}
            </Typography>
            {canAssign && (
              <Button variant="contained" onClick={() => setResOpen(true)}>
                {t("parkingAddReservation")}
              </Button>
            )}
          </Stack>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("parkingColDate")}</TableCell>
                  <TableCell>{t("parkingColSpot")}</TableCell>
                  <TableCell>{t("parkingColGuest")}</TableCell>
                  <TableCell>{t("parkingColHours")}</TableCell>
                  {canAssign && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {(resQ.data ?? []).map((r) => {
                  const spot = spotById.get(r.spotId);
                  const guest = employeesForUi.find((e) => e.id === r.employeeId);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.workDate}</TableCell>
                      <TableCell>{spot?.label ?? r.spotId.slice(-6)}</TableCell>
                      <TableCell>{r.guestFullName || guest?.fullName || r.employeeId.slice(-6)}</TableCell>
                      <TableCell>
                        {r.hourStart != null || r.hourEnd != null
                          ? `${r.hourStart ?? "—"}–${r.hourEnd ?? "—"}`
                          : t("parkingFullDay")}
                      </TableCell>
                      {canAssign && (
                        <TableCell>
                          <Button
                            size="small"
                            color="error"
                            disabled={delResMut.isPending}
                            onClick={() => {
                              if (confirm(t("parkingConfirmDelete"))) delResMut.mutate(r.id);
                            }}
                          >
                            {t("delete")}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={resOpen} onClose={() => setResOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t("parkingAddReservation")}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField select label={t("parkingColSpot")} value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              {(spotsQ.data ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id} disabled={!s.isActive}>
                  {s.label} · {s.locationName}
                </MenuItem>
              ))}
            </TextField>
            <TextField select label={t("parkingColGuest")} value={empId} onChange={(e) => setEmpId(e.target.value)}>
              {employeesForUi.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.fullName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label={t("parkingColDate")}
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t("parkingHourStart")}
              type="number"
              value={hourStart}
              onChange={(e) => setHourStart(e.target.value)}
              inputProps={{ min: 0, max: 24, step: 0.5 }}
              helperText={t("parkingHoursOptional")}
            />
            <TextField
              label={t("parkingHourEnd")}
              type="number"
              value={hourEnd}
              onChange={(e) => setHourEnd(e.target.value)}
              inputProps={{ min: 0, max: 24, step: 0.5 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResOpen(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={!spotId || !empId || createResMut.isPending}
            onClick={() => createResMut.mutate()}
          >
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
