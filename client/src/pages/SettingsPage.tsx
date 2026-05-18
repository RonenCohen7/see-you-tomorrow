import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useThemeMode } from "../theme/ThemeModeContext";
import { useRole } from "../store/authContext";
import React from "react";
import { STATUS_ORDER } from "../utils/statusMeta";

type OrgSettingsResponse = {
  managerCanEditSchedules: boolean;
  preferenceMinDaysAhead: number;
  preferenceRemindersEnabled: boolean;
  disabledBuiltinScheduleStatuses?: string[];
  customScheduleStatuses: { id: string; labelHe: string; labelEn?: string; disabled?: boolean }[];
};

type OrgSettingsPatch = Partial<{
  managerCanEditSchedules: boolean;
  preferenceMinDaysAhead: number;
  preferenceRemindersEnabled: boolean;
  disabledBuiltinScheduleStatuses: string[];
  customScheduleStatuses: CustomScheduleStatusWire[];
}>;

type CustomScheduleStatusWire = {
  id?: string;
  labelHe: string;
  labelEn?: string;
  disabled?: boolean;
};

/** Local row: `labelEn` always string for controlled TextField even when omitted on wire. */
type CustomDraftRow = { id: string; labelHe: string; labelEn: string; disabled: boolean };

function toCustomDraft(rows: OrgSettingsResponse["customScheduleStatuses"] | undefined): CustomDraftRow[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    labelHe: r.labelHe,
    labelEn: r.labelEn ?? "",
    disabled: r.disabled === true,
  }));
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { mode, toggle } = useThemeMode();
  const role = useRole();
  const qc = useQueryClient();
  const [bcTitle, setBcTitle] = React.useState("");
  const [bcMessage, setBcMessage] = React.useState("");
  const [bcSeverity, setBcSeverity] = React.useState<"info" | "warning" | "error">("info");

  const orgQ = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => (await api.get<OrgSettingsResponse>("/api/schedules/org-settings")).data,
    enabled: role === "admin",
  });

  const [draftCustomStatuses, setDraftCustomStatuses] = React.useState<CustomDraftRow[]>([]);
  const [draftDisabledBuiltins, setDraftDisabledBuiltins] = React.useState<string[]>([]);
  const orgWireSigRef = React.useRef("");

  const patchOrg = useMutation({
    mutationFn: async (patch: OrgSettingsPatch) =>
      (await api.patch<OrgSettingsResponse>("/api/schedules/org-settings", patch)).data,
    onSuccess: async (updated) => {
      const sig = `${JSON.stringify(updated.customScheduleStatuses)}|${JSON.stringify(updated.disabledBuiltinScheduleStatuses)}`;
      orgWireSigRef.current = sig;
      setDraftCustomStatuses(toCustomDraft(updated.customScheduleStatuses));
      setDraftDisabledBuiltins([...(updated.disabledBuiltinScheduleStatuses ?? [])]);
      await qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
  });

  React.useEffect(() => {
    if (!orgQ.isSuccess || !orgQ.data) return;
    const sig = `${JSON.stringify(orgQ.data.customScheduleStatuses)}|${JSON.stringify(orgQ.data.disabledBuiltinScheduleStatuses)}`;
    if (sig === orgWireSigRef.current) return;
    orgWireSigRef.current = sig;
    setDraftCustomStatuses(toCustomDraft(orgQ.data.customScheduleStatuses));
    setDraftDisabledBuiltins([...(orgQ.data.disabledBuiltinScheduleStatuses ?? [])]);
  }, [orgQ.isSuccess, orgQ.data]);

  const [prefMinDraft, setPrefMinDraft] = React.useState(7);
  React.useEffect(() => {
    if (orgQ.data?.preferenceMinDaysAhead != null) setPrefMinDraft(orgQ.data.preferenceMinDaysAhead);
  }, [orgQ.data?.preferenceMinDaysAhead]);

  const systemBroadcast = useMutation({
    mutationFn: async () =>
      api.post("/api/notifications/admin/system-broadcast", {
        title: bcTitle.trim(),
        message: bcMessage.trim(),
        severity: bcSeverity,
      }),
    onSuccess: () => {
      setBcTitle("");
      setBcMessage("");
      setBcSeverity("info");
    },
  });

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("settings")}
      </Typography>
      <FormControlLabel
        sx={{ alignItems: "flex-start", mr: 0, "& .MuiFormControlLabel-label": { whiteSpace: "normal" } }}
        control={<Switch checked={mode === "dark"} onChange={toggle} />}
        label={t("darkMode")}
      />

      {role === "admin" && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t("settingsOrgHeading")}
          </Typography>
          <FormControlLabel
            sx={{ alignItems: "flex-start", mr: 0, "& .MuiFormControlLabel-label": { whiteSpace: "normal" } }}
            control={
              <Switch
                checked={!!orgQ.data?.managerCanEditSchedules}
                onChange={(_, v) => patchOrg.mutate({ managerCanEditSchedules: v })}
                disabled={orgQ.isLoading || patchOrg.isPending}
              />
            }
            label={t("settingsManagersEditShifts")}
          />

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            {t("settingsPrefBeforeAi")}
          </Typography>
          <Stack spacing={2} sx={{ mt: 1, maxWidth: 400 }}>
            <TextField
              label={t("settingsPrefMinDaysLabel")}
              type="number"
              size="small"
              value={prefMinDraft}
              onChange={(e) => setPrefMinDraft(Number(e.target.value))}
              disabled={orgQ.isLoading || patchOrg.isPending}
              inputProps={{ min: 0, max: 60 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={orgQ.isLoading || patchOrg.isPending}
              onClick={() => patchOrg.mutate({ preferenceMinDaysAhead: prefMinDraft })}
            >
              {t("settingsPrefMinDaysSave")}
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={!!orgQ.data?.preferenceRemindersEnabled}
                  onChange={(_, v) => patchOrg.mutate({ preferenceRemindersEnabled: v })}
                  disabled={orgQ.isLoading || patchOrg.isPending}
                />
              }
              label={t("settingsPrefReminders")}
            />
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            {t("settingsBuiltinStatusesHeading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("settingsBuiltinStatusesHint")}
          </Typography>
          <Stack spacing={1} sx={{ maxWidth: 480, mb: 2 }}>
            {STATUS_ORDER.map((k) => (
              <FormControlLabel
                key={k}
                sx={{ mr: 0, alignItems: "center" }}
                control={
                  <Switch
                    size="small"
                    checked={!draftDisabledBuiltins.includes(k)}
                    disabled={patchOrg.isPending || orgQ.isLoading}
                    onChange={(_, checked) => {
                      setDraftDisabledBuiltins((prev) =>
                        checked ? prev.filter((x) => x !== k) : [...new Set([...prev, k])]
                      );
                    }}
                  />
                }
                label={
                  <Typography variant="body2">
                    {t(k)} — {t("settingsBuiltinStatusShown")}
                  </Typography>
                }
              />
            ))}
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            {t("settingsCustomStatusesHeading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("settingsCustomStatusesHint")}
          </Typography>
          <Stack spacing={1.25} sx={{ maxWidth: 720, mb: 2 }}>
            {draftCustomStatuses.map((row, idx) => (
              <Stack direction={{ xs: "column", lg: "row" }} spacing={1} alignItems={{ lg: "center" }} key={row.id || `new-${idx}`}>
                <TextField
                  label={t("settingsCustomLabelHe")}
                  value={row.labelHe}
                  required
                  size="small"
                  fullWidth
                  inputProps={{ maxLength: 120 }}
                  disabled={patchOrg.isPending}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftCustomStatuses((cur) =>
                      cur.map((r, i) => (i === idx ? { ...r, labelHe: v } : r))
                    );
                  }}
                />
                <TextField
                  label={t("settingsCustomLabelEn")}
                  value={row.labelEn}
                  size="small"
                  fullWidth
                  sx={{ flex: 1 }}
                  inputProps={{ maxLength: 120 }}
                  disabled={patchOrg.isPending}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftCustomStatuses((cur) =>
                      cur.map((r, i) => (i === idx ? { ...r, labelEn: v } : r))
                    );
                  }}
                />
                <FormControlLabel
                  sx={{ mr: 0, flexShrink: 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={!row.disabled}
                      disabled={patchOrg.isPending}
                      onChange={(_, c) =>
                        setDraftCustomStatuses((cur) =>
                          cur.map((r, i) => (i === idx ? { ...r, disabled: !c } : r))
                        )
                      }
                    />
                  }
                  label={<Typography variant="caption">{t("settingsCustomActive")}</Typography>}
                />
                <IconButton
                  aria-label={t("settingsRemoveStatusAria")}
                  size="small"
                  disabled={patchOrg.isPending}
                  onClick={() => setDraftCustomStatuses((cur) => cur.filter((_, i) => i !== idx))}
                  color="error"
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={draftCustomStatuses.length >= 40 || patchOrg.isPending}
              onClick={() =>
                setDraftCustomStatuses((cur) => [...cur, { id: "", labelHe: "", labelEn: "", disabled: false }])
              }
            >
              {t("settingsAddStatus")}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={patchOrg.isPending || draftCustomStatuses.some((r) => !r.labelHe.trim())}
              onClick={() => {
                const payload: CustomScheduleStatusWire[] = draftCustomStatuses.map((row) => {
                  const trimmedId = row.id.trim();
                  const labelHe = row.labelHe.trim();
                  const en = row.labelEn.trim();
                  const base: CustomScheduleStatusWire =
                    trimmedId === ""
                      ? { labelHe }
                      : { id: trimmedId, labelHe };
                  const withEn = en !== "" ? { ...base, labelEn: en } : base;
                  return row.disabled ? { ...withEn, disabled: true } : withEn;
                });
                patchOrg.mutate({
                  customScheduleStatuses: payload,
                  disabledBuiltinScheduleStatuses: draftDisabledBuiltins,
                });
              }}
            >
              {t("settingsSaveStatuses")}
            </Button>
          </Stack>
          {patchOrg.isError ? (
            <Alert severity="error" sx={{ maxWidth: 640, mb: 2 }}>
              {(patchOrg.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                t("settingsSaveStatusesFailed")}
            </Alert>
          ) : null}

          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            {t("settingsSchedulingRulesHeading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("settingsSchedulingRulesBlurb")}
          </Typography>
          <Button component={RouterLink} to="/scheduling-rules" variant="outlined" size="small" sx={{ mb: 3 }}>
            {t("settingsSchedulingRulesCta")}
          </Button>

          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            {t("settingsBroadcastHeading")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("settingsBroadcastBlurb")}
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 560 }}>
            {systemBroadcast.isError ? (
              <Alert severity="error">
                {(systemBroadcast.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                  t("settingsBroadcastFailed")}
              </Alert>
            ) : null}
            {systemBroadcast.isSuccess ? <Alert severity="success">{t("settingsBroadcastSent")}</Alert> : null}
            <TextField
              label={t("settingsBroadcastTitle")}
              value={bcTitle}
              onChange={(e) => {
                setBcTitle(e.target.value);
                systemBroadcast.reset();
              }}
              required
              inputProps={{ maxLength: 120 }}
              fullWidth
              size="small"
            />
            <TextField
              label={t("settingsBroadcastMessage")}
              value={bcMessage}
              onChange={(e) => {
                setBcMessage(e.target.value);
                systemBroadcast.reset();
              }}
              required
              multiline
              minRows={3}
              inputProps={{ maxLength: 2000 }}
              fullWidth
              size="small"
            />
            <FormControl size="small" sx={{ maxWidth: 220 }}>
              <InputLabel id="sys-bc-severity">{t("settingsBroadcastSeverity")}</InputLabel>
              <Select
                labelId="sys-bc-severity"
                label={t("settingsBroadcastSeverity")}
                value={bcSeverity}
                onChange={(e) => {
                  setBcSeverity(e.target.value as "info" | "warning" | "error");
                  systemBroadcast.reset();
                }}
              >
                <MenuItem value="info">{t("settingsBroadcastSeverityInfo")}</MenuItem>
                <MenuItem value="warning">{t("settingsBroadcastSeverityWarning")}</MenuItem>
                <MenuItem value="error">{t("settingsBroadcastSeverityError")}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={
                systemBroadcast.isPending || bcTitle.trim().length === 0 || bcMessage.trim().length === 0
              }
              onClick={() => systemBroadcast.mutate()}
            >
              {t("settingsBroadcastSend")}
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
