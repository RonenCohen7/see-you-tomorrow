import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { utcWeekdayShort } from "../utils/israeliWeek";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import { pipelineAlertPresentation } from "../utils/preferencePipelinePresentation";

function addUtcDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) ?? 1) + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

type PrefDay = { workDate: string; preference?: "office" | "home" | "vacation" | "off" };

type PreferenceDoc = {
  id: string;
  weekStartSunday: string;
  days: PrefDay[];
  status: "draft" | "submitted";
};

export default function AttendancePreferencesPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const theme = useTheme();
  const qc = useQueryClient();

  const ctx = useQuery({
    queryKey: ["pref-context"],
    queryFn: async () =>
      (
        await api.get<{
          preferenceMinDaysAhead: number;
          earliestAllowedWeekStartSunday: string;
          preferenceRemindersEnabled: boolean;
        }>("/api/schedules/preferences/context")
      ).data,
  });

  const weekOptions = useMemo(() => {
    const start = ctx.data?.earliestAllowedWeekStartSunday;
    if (!start) return [] as string[];
    const opts: string[] = [];
    for (let i = 0; i < 8; i++) opts.push(addUtcDaysIso(start, i * 7));
    return opts;
  }, [ctx.data?.earliestAllowedWeekStartSunday]);

  const [week, setWeek] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, "office" | "home" | "vacation" | "off" | "">>({});
  const [preferEmptyDraft, setPreferEmptyDraft] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  useEffect(() => {
    if (!week && weekOptions.length > 0) setWeek(weekOptions[0] ?? "");
  }, [week, weekOptions]);

  const prefQ = useQuery({
    queryKey: ["attendance-pref", week],
    queryFn: async () => {
      if (!week) return null;
      const { data } = await api.get<PreferenceDoc | null>(
        `/api/schedules/preferences/attendance/week/${week}`
      );
      return data;
    },
    enabled: !!week,
  });

  const pipelineQ = useQuery({
    queryKey: ["pref-pipeline", week],
    queryFn: async () =>
      (
        await api.get<{
          weekStartSunday: string;
          departmentId?: string;
          pipelineStatus?: string;
          lastError?: string;
          aiBatchId?: string;
          preferenceSummary?: {
            matchedPreference?: number;
            differsFromPreference?: number;
            noSubmittedPreferenceForSlot?: number;
            recommendationRows?: number;
          };
        }>(`/api/schedules/preferences/attendance/pipeline`, {
          params: { weekStartSunday: week },
        })
      ).data,
    enabled: !!week,
    refetchInterval: (query) =>
      ["queued", "ai_running"].includes(query.state.data?.pipelineStatus ?? "") ? 10_000 : false,
  });

  const days = prefQ.data?.days ?? [];

  useEffect(() => {
    const d = prefQ.data?.days;
    if (!d?.length) {
      setDraft({});
      return;
    }
    if (preferEmptyDraft) return;
    const next: Record<string, "office" | "home" | "vacation" | "off" | ""> = {};
    for (const row of d) {
      next[row.workDate] = row.preference ?? "";
    }
    setDraft(next);
  }, [week, prefQ.isSuccess, prefQ.data, preferEmptyDraft]);

  const saveMut = useMutation({
    mutationFn: async (submit: boolean) => {
      const dayRows: PrefDay[] = days.map((d) => ({
        workDate: d.workDate,
        ...(draft[d.workDate] && draft[d.workDate] !== ""
          ? { preference: draft[d.workDate] as "office" | "home" | "vacation" | "off" }
          : {}),
      }));
      await api.put("/api/schedules/preferences/attendance", {
        weekStartSunday: week,
        days: dayRows,
        submit,
      });
    },
    onSuccess: async (_data, vars) => {
      if (vars === false) {
        await qc.invalidateQueries({ queryKey: ["attendance-pref", week] });
        setPreferEmptyDraft(false);
      }
    },
  });

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  return (
    <Box sx={{ width: "100%", maxWidth: 720 }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("prefAttendanceScreenTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("prefAttendanceScreenSubtitle")}
      </Typography>

      {ctx.isLoading ? (
        <Typography>{t("loading")}</Typography>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("prefAttendanceEarliestWeekLine", {
            week: ctx.data?.earliestAllowedWeekStartSunday ?? "—",
            days: ctx.data?.preferenceMinDaysAhead ?? "—",
            reminders: ctx.data?.preferenceRemindersEnabled ? t("prefAttendanceRemindersSuffix") : "",
          })}
        </Alert>
      )}

      <FormControl sx={{ mb: 2, minWidth: 220 }} size="small">
        <InputLabel id="week-pick">{t("teamAttendancePrefsWeek")}</InputLabel>
        <Select
          labelId="week-pick"
          label={t("teamAttendancePrefsWeek")}
          value={week || ""}
          onChange={(e) => {
            setWeek(e.target.value);
            setDraft({});
            setPreferEmptyDraft(false);
          }}
        >
          {weekOptions.map((w) => (
            <MenuItem key={w} value={w}>
              {w}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {prefQ.data?.status === "submitted" ? (
        !pipelineQ.data?.departmentId ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("prefPipelineNoDept")}
          </Alert>
        ) : pipelineQ.data?.pipelineStatus ? (
          (() => {
            const pres = pipelineAlertPresentation(pipelineQ.data.pipelineStatus, theme);
            return (
              <Alert severity={pres.severity} sx={{ mb: 2, ...pres.sx }}>
                {pres.chipTranslationKey ? (
                  <Chip
                    size="small"
                    label={t(pres.chipTranslationKey)}
                    color={pres.chipColor}
                    sx={{ mb: 1, fontWeight: 700 }}
                  />
                ) : null}
                <Typography variant="subtitle2" gutterBottom>
                  {t("prefPipelineTitle")}
                </Typography>
                <Typography variant="body2">
                  {t(`prefPipeline_${pipelineQ.data.pipelineStatus}` as "prefPipeline_queued")}
                  {pipelineQ.data.pipelineStatus === "ai_failed" && pipelineQ.data.lastError
                    ? ` ${pipelineQ.data.lastError}`
                    : ""}
                </Typography>
                {pipelineQ.data.preferenceSummary &&
                pipelineQ.data.pipelineStatus === "awaiting_manager" ? (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    {t("prefPipelineSummaryHint", {
                      match: pipelineQ.data.preferenceSummary.matchedPreference ?? "—",
                      diff: pipelineQ.data.preferenceSummary.differsFromPreference ?? "—",
                      unknown: pipelineQ.data.preferenceSummary.noSubmittedPreferenceForSlot ?? "—",
                    })}
                  </Typography>
                ) : null}
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }} color="text.secondary">
                  {t("prefPipelineSubtitle")}
                </Typography>
              </Alert>
            );
          })()
        ) : pipelineQ.isLoading ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t("loading")}
          </Typography>
        ) : null
      ) : null}

      <Stack spacing={1.5}>
        {days.map((d) => {
          const val = draft[d.workDate] ?? "";
          return (
            <Stack key={d.workDate} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography sx={{ width: { sm: 200 } }}>
                {d.workDate} · {utcWeekdayShort(d.workDate, intlTag)}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id={`lbl-${d.workDate}`}>{t("prefDayPreferenceLabel")}</InputLabel>
                <Select
                  labelId={`lbl-${d.workDate}`}
                  label={t("prefDayPreferenceLabel")}
                  value={val}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [d.workDate]: e.target.value as "office" | "home" | "vacation" | "off" | "",
                    }))
                  }
                >
                  <MenuItem value="">{t("prefClearPreference")}</MenuItem>
                  <MenuItem value="office">{t("office")}</MenuItem>
                  <MenuItem value="home">{t("home")}</MenuItem>
                  <MenuItem value="vacation">{t("vacation")}</MenuItem>
                  <MenuItem value="off">{t("off")}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          disabled={!week || saveMut.isPending}
          onClick={() => {
            saveMut.mutate(false, {
              onSuccess: () => setToast({ ok: true, msg: t("prefToastDraftSaved") }),
              onError: (e) =>
                setToast({
                  ok: false,
                  msg: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("error"),
                }),
            });
          }}
        >
          {t("prefSaveDraft")}
        </Button>
        <Button
          variant="contained"
          disabled={!week || saveMut.isPending}
          onClick={() => setSubmitConfirmOpen(true)}
        >
          {t("prefSubmitPrefs")}
        </Button>
      </Stack>

      {prefQ.data?.status ? (
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          {t("prefCurrentStatusLine", {
            status:
              prefQ.data.status === "submitted" ? t("prefDocStatusSubmitted") : t("prefDocStatusDraft"),
          })}
        </Typography>
      ) : null}

      {preferEmptyDraft && prefQ.data?.status === "submitted" ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          {t("prefFormClearedHint")}
        </Alert>
      ) : null}

      <Dialog open={submitConfirmOpen} onClose={() => !saveMut.isPending && setSubmitConfirmOpen(false)}>
        <DialogTitle>{t("prefSubmitConfirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ pt: 0.5 }}>
            {t("prefSubmitConfirmBody")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitConfirmOpen(false)} disabled={saveMut.isPending}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={saveMut.isPending}
            onClick={() => {
              const daySnapshot = [...days];
              saveMut.mutate(true, {
                onSuccess: async () => {
                  setPreferEmptyDraft(true);
                  const empty: Record<string, "office" | "home" | "vacation" | "off" | ""> = {};
                  for (const row of daySnapshot) empty[row.workDate] = "";
                  setDraft(empty);
                  setSubmitConfirmOpen(false);
                  await qc.invalidateQueries({ queryKey: ["attendance-pref", week] });
                  await qc.invalidateQueries({ queryKey: ["pref-pipeline", week] });
                  setToast({ ok: true, msg: t("prefToastSubmittedOk") });
                },
                onError: (e) =>
                  setToast({
                    ok: false,
                    msg: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("error"),
                  }),
              });
            }}
          >
            {saveMut.isPending ? t("loading") : t("prefSubmitConfirmSend")}
          </Button>
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
