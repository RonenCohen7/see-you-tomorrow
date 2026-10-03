import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useAuth } from "../store/authContext";
import { addDaysIsoLocal, todayIsoLocal } from "../utils/date";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { utcWeekdayShort } from "../utils/israeliWeek";
import { appIntlLocale, type AppLocale } from "../locale/localeConstants";

type DaySpot = {
  spotId: string;
  label: string;
  locationId: string;
  locationName: string;
  ownerId?: string;
  ownerName?: string;
  ownerInOffice: boolean;
  state: "free" | "owner_reserved" | "taken";
  reservation?: {
    id: string;
    employeeId: string;
    employeeName: string;
    selfClaimed: boolean;
    auto: boolean;
  };
};

export const PARKING_DAY_QUERY_KEY = "parking-day";

export function ParkingClaimPanel() {
  const { t, i18n } = useTranslation();
  const intlTag = appIntlLocale(i18n.language as AppLocale);
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayIsoLocal();
  const tomorrow = addDaysIsoLocal(today, 1);
  const [date, setDate] = useState(today);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const dayQ = useQuery({
    queryKey: [PARKING_DAY_QUERY_KEY, date],
    queryFn: async () => (await api.get<{ items: DaySpot[] }>(`/api/parking/day?date=${date}`)).data.items,
    refetchInterval: 20_000,
  });

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: [PARKING_DAY_QUERY_KEY] });
    void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
  };

  const claimMut = useMutation({
    mutationFn: async (spotId: string) => api.post("/api/parking/claim", { spotId, workDate: date }),
    onSuccess: async () => {
      setToast({ ok: true, msg: t("myParkingClaimed") });
      await refreshAll();
    },
    onError: async (err) => {
      setToast({ ok: false, msg: apiErrorMessage(err, t("error")) });
      await refreshAll();
    },
  });

  const releaseMut = useMutation({
    mutationFn: async (reservationId: string) => api.delete(`/api/parking/reservations/${reservationId}`),
    onSuccess: async () => {
      setToast({ ok: true, msg: t("myParkingReleased") });
      await refreshAll();
    },
    onError: (err) => setToast({ ok: false, msg: apiErrorMessage(err, t("error")) }),
  });

  const spots = dayQ.data ?? [];
  const mine = spots.find((s) => s.reservation?.employeeId === user?.id);
  const myFixed = spots.find((s) => s.ownerId === user?.id);
  const freeCount = spots.filter((s) => s.state === "free").length;

  const groups = useMemo(() => {
    const byLoc = new Map<string, { name: string; items: DaySpot[] }>();
    for (const s of dayQ.data ?? []) {
      const g = byLoc.get(s.locationId) ?? { name: s.locationName, items: [] };
      g.items.push(s);
      byLoc.set(s.locationId, g);
    }
    return [...byLoc.entries()]
      .sort(([a], [b]) => (a === user?.locationId ? -1 : b === user?.locationId ? 1 : 0))
      .map(([id, g]) => ({ id, ...g }));
  }, [dayQ.data, user?.locationId]);

  const locSuffix = (s: DaySpot) => (s.locationName ? ` · ${s.locationName}` : "");
  const busy = claimMut.isPending || releaseMut.isPending;

  const stateLabel = (s: DaySpot) => {
    if (s.state === "taken") {
      return s.reservation?.employeeId === user?.id
        ? t("myParkingStateTakenByYou")
        : t("myParkingStateTakenBy", { name: s.reservation?.employeeName || t("parkingOtherHolder") });
    }
    if (s.state === "owner_reserved") return t("myParkingStateOwnerReserved", { owner: s.ownerName || "" });
    if (s.ownerId) return t("myParkingStateFreeOwnerAway", { owner: s.ownerName || "" });
    return t("myParkingStateFree");
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip
          label={t("myParkingToday")}
          color={date === today ? "primary" : "default"}
          variant={date === today ? "filled" : "outlined"}
          onClick={() => setDate(today)}
        />
        <Chip
          label={t("myParkingTomorrow")}
          color={date === tomorrow ? "primary" : "default"}
          variant={date === tomorrow ? "filled" : "outlined"}
          onClick={() => setDate(tomorrow)}
        />
        <TextField
          type="date"
          size="small"
          label={t("myParkingPickDate")}
          value={date}
          inputProps={{ min: today }}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        {!dayQ.isLoading && spots.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {utcWeekdayShort(date, intlTag)} {date} · {t("myParkingFreeCount", { free: freeCount, total: spots.length })}
          </Typography>
        )}
      </Stack>

      {mine?.reservation && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("myParkingReleaseConfirm"))) releaseMut.mutate(mine.reservation!.id);
              }}
            >
              {t("myParkingRelease")}
            </Button>
          }
        >
          {t("myParkingYouHold", { spot: mine.label, loc: locSuffix(mine), date })}
        </Alert>
      )}

      {myFixed && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={700}>
            {t("myParkingYourFixed", { spot: myFixed.label, loc: locSuffix(myFixed) })}
          </Typography>
          {!myFixed.ownerInOffice && (
            <Typography variant="body2">
              {myFixed.reservation
                ? t("myParkingYourFixedTakenBy", { name: myFixed.reservation.employeeName })
                : t("myParkingYourFixedFree")}
            </Typography>
          )}
        </Alert>
      )}

      {dayQ.isLoading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : spots.length === 0 ? (
        <Alert severity="info">{t("myParkingNoSpots")}</Alert>
      ) : (
        <Stack spacing={2}>
          {groups.map((g) => (
            <Box key={g.id}>
              {groups.length > 1 && (
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {g.name}
                </Typography>
              )}
              <Box
                sx={{
                  display: "grid",
                  gap: 1.25,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                }}
              >
                {g.items.map((s) => {
                  const isMine = s.reservation?.employeeId === user?.id;
                  const color = s.state === "free" ? "success" : isMine ? "primary" : s.state === "taken" ? "warning" : "default";
                  const canClaim = s.state === "free" && !mine && s.ownerId !== user?.id;
                  return (
                    <Card
                      key={s.spotId}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderColor: s.state === "free" ? "success.main" : isMine ? "primary.main" : "divider",
                        borderWidth: s.state === "free" || isMine ? 2 : 1,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <LocalParkingIcon color={s.state === "free" ? "success" : "disabled"} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
                          {s.label}
                        </Typography>
                      </Stack>
                      <Chip size="small" color={color} label={stateLabel(s)} sx={{ maxWidth: "100%", mb: 1 }} />
                      {canClaim && (
                        <Button
                          fullWidth
                          variant="contained"
                          color="success"
                          size="small"
                          disabled={busy}
                          onClick={() => claimMut.mutate(s.spotId)}
                        >
                          {t("myParkingClaim")}
                        </Button>
                      )}
                      {isMine && s.reservation && (
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(t("myParkingReleaseConfirm"))) releaseMut.mutate(s.reservation!.id);
                          }}
                        >
                          {t("myParkingRelease")}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.msg ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        ContentProps={{ sx: toast?.ok ? { bgcolor: "success.dark" } : { bgcolor: "error.dark" } }}
      />
    </Box>
  );
}
