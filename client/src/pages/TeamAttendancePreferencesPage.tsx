import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { departmentsPickerUrl } from "../utils/referencePickerUrls";
import type { Employee } from "../types/models";
import { useTranslation } from "react-i18next";
import { useAuth, useRole } from "../store/authContext";
import { utcWeekdayShort } from "../utils/israeliWeek";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import { Link as RouterLink } from "react-router-dom";
import { pipelineAlertPresentation } from "../utils/preferencePipelinePresentation";

function addUtcDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) ?? 1) + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

type PrefDay = { workDate: string; preference?: "office" | "home" | "vacation" | "off" };

type DeptPreferenceRow = {
  id: string;
  employeeId: string;
  weekStartSunday: string;
  days: PrefDay[];
  status: string;
  submittedAt?: string;
};

export default function TeamAttendancePreferencesPage() {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  const theme = useTheme();
  const role = useRole();
  const { user } = useAuth();

  const ctxQ = useQuery({
    queryKey: ["pref-context"],
    queryFn: async () =>
      (
        await api.get<{
          preferenceMinDaysAhead: number;
          earliestAllowedWeekStartSunday: string;
        }>("/api/schedules/preferences/context")
      ).data,
  });

  const departmentsQ = useQuery({
    queryKey: ["departments-team-prefs"],
    queryFn: async () =>
      (await api.get<{ items: { id: string; name: string }[] }>(departmentsPickerUrl())).data.items,
    enabled: role === "admin",
  });

  const [deptId, setDeptId] = useState("");
  useEffect(() => {
    if (role === "manager" && user?.departmentId) setDeptId(user.departmentId);
  }, [role, user?.departmentId]);

  const weekOptions = useMemo(() => {
    const start = ctxQ.data?.earliestAllowedWeekStartSunday;
    if (!start) return [] as string[];
    const opts: string[] = [];
    for (let i = 0; i < 8; i++) opts.push(addUtcDaysIso(start, i * 7));
    return opts;
  }, [ctxQ.data?.earliestAllowedWeekStartSunday]);

  const [week, setWeek] = useState("");
  useEffect(() => {
    if (!week && weekOptions.length > 0) setWeek(weekOptions[0] ?? "");
  }, [week, weekOptions]);

  const prefsQ = useQuery({
    queryKey: ["dept-attendance-prefs", deptId, week],
    queryFn: async () =>
      (
        await api.get<{ items: DeptPreferenceRow[] }>(
          `/api/schedules/preferences/attendance/dept?departmentId=${encodeURIComponent(deptId)}&weekStartSunday=${encodeURIComponent(week)}`
        )
      ).data.items,
    enabled: Boolean(deptId && week),
  });

  const deptPipelineQ = useQuery({
    queryKey: ["dept-attendance-pipeline", deptId, week],
    queryFn: async () =>
      (
        await api.get<{
          weekStartSunday: string;
          departmentId: string;
          pipelineStatus: string | null;
          lastError?: string;
          aiBatchId?: string;
        }>(`/api/schedules/preferences/attendance/dept-pipeline`, {
          params: { departmentId: deptId, weekStartSunday: week },
        })
      ).data,
    enabled: Boolean(deptId && week),
    refetchInterval: (q) =>
      q.state.data?.pipelineStatus != null && ["queued", "ai_running"].includes(q.state.data.pipelineStatus)
        ? 10_000
        : false,
  });

  const employeesQ = useQuery({
    queryKey: ["employees-dept-prefs", deptId],
    enabled: Boolean(deptId),
    queryFn: async () => {
      const limit = 100;
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=${limit}&departmentId=${encodeURIComponent(deptId)}`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return all;
    },
  });

  const empMap = useMemo(() => new Map((employeesQ.data ?? []).map((e) => [e.id, e])), [employeesQ.data]);

  return (
    <Box sx={{ width: "100%", maxWidth: 960 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <FactCheckIcon color="primary" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
          {t("teamAttendancePrefs")}
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        {t("teamAttendancePrefsIntro")}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          {t("teamPipelineExplainTitle")}
        </Typography>
        <Typography variant="body2">{t("teamPipelineExplainBody")}</Typography>
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {role === "admin" ? (
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="dept-pick">{t("departments")}</InputLabel>
                <Select
                  labelId="dept-pick"
                  label={t("departments")}
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                >
                  {(departmentsQ.data ?? []).map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t("teamAttendancePrefsDeptLocked")}
              </Typography>
            )}
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="week-pick-team">{t("teamAttendancePrefsWeek")}</InputLabel>
              <Select labelId="week-pick-team" label={t("teamAttendancePrefsWeek")} value={week} onChange={(e) => setWeek(e.target.value)}>
                {weekOptions.map((w) => (
                  <MenuItem key={w} value={w}>
                    {w}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {deptId && week && deptPipelineQ.data && (() => {
        const rawStatus = deptPipelineQ.data.pipelineStatus;
        const hasSubmissions = (prefsQ.data?.length ?? 0) > 0;

        if (rawStatus === null && hasSubmissions) {
          return (
            <Alert
              severity="warning"
              sx={{
                mb: 2,
                borderLeftWidth: 4,
                borderLeftStyle: "solid",
                borderLeftColor: theme.palette.warning.main,
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {t("teamPipelineStatusHeading")}
                {`: ${t("teamPipelineNoDocShort")}`}
              </Typography>
              <Typography variant="body2">{t("teamPipelineNoDocWithSubmissions")}</Typography>
            </Alert>
          );
        }

        if (rawStatus === null && !hasSubmissions) return null;

        const pres =
          rawStatus !== null && rawStatus !== undefined
            ? pipelineAlertPresentation(rawStatus, theme)
            : { severity: "info" as const, sx: {} };

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
              {t("teamPipelineStatusHeading")}
              {rawStatus
                ? `: ${t(`prefPipeline_${rawStatus}` as "prefPipeline_queued")}`
                : ""}
            </Typography>
            {rawStatus === "ai_failed" && deptPipelineQ.data.lastError ? (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {deptPipelineQ.data.lastError}
              </Typography>
            ) : null}
            {rawStatus === "awaiting_manager" ? (
              <Button
                component={RouterLink}
                to="/preference-ai-queue"
                size="small"
                variant="contained"
                sx={{ mt: 1 }}
              >
                {t("teamPipelineOpenQueue")}
              </Button>
            ) : null}
            {rawStatus === "applied" ? (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t("teamPipelineAppliedFootnote")}
              </Typography>
            ) : null}
          </Alert>
        );
      })()}

      {deptId && week && deptPipelineQ.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("networkError")}
        </Alert>
      ) : null}

      {!deptId ? (
        <Alert severity="info">{role === "admin" ? t("teamAttendancePrefsPickDept") : t("teamAttendancePrefsNoDept")}</Alert>
      ) : prefsQ.isLoading ? (
        <Typography>{t("loading")}</Typography>
      ) : (() => {
          const rows = prefsQ.data ?? [];
          const headerDays = rows[0]?.days ?? [];
          if (rows.length === 0) {
            return <Alert severity="warning">{t("teamAttendancePrefsEmpty")}</Alert>;
          }
          return (
            <Card>
              <CardContent sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("fullName")}</TableCell>
                      <TableCell>{t("teamAttendancePrefsSubmittedAt")}</TableCell>
                      {headerDays.map((d) => (
                        <TableCell key={d.workDate} sx={{ whiteSpace: "nowrap" }}>
                          {d.workDate.slice(5)}
                          <Typography variant="caption" display="block" color="text.secondary">
                            {utcWeekdayShort(d.workDate, intlTag)}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const name = empMap.get(row.employeeId)?.fullName ?? `…${row.employeeId.slice(-6)}`;
                      const byDate = new Map(row.days.map((d) => [d.workDate, d.preference]));
                      return (
                        <TableRow key={row.id}>
                          <TableCell sx={{ fontWeight: 700 }}>{name}</TableCell>
                          <TableCell>{row.submittedAt ? new Date(row.submittedAt).toLocaleString(intlTag) : "—"}</TableCell>
                          {headerDays.map((col) => {
                            const p = byDate.get(col.workDate);
                            return (
                              <TableCell key={col.workDate}>{p ? t(p) : "—"}</TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })()}
    </Box>
  );
}
