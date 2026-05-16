import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useThemeMode } from "../theme/ThemeModeContext";
import { useRole } from "../store/authContext";
import React from "react";

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
    queryFn: async () =>
      (
        await api.get<{
          managerCanEditSchedules: boolean;
          preferenceMinDaysAhead: number;
          preferenceRemindersEnabled: boolean;
        }>("/api/schedules/org-settings")
      ).data,
    enabled: role === "admin",
  });

  const patchOrg = useMutation({
    mutationFn: async (patch: Partial<{
      managerCanEditSchedules: boolean;
      preferenceMinDaysAhead: number;
      preferenceRemindersEnabled: boolean;
    }>) => api.patch("/api/schedules/org-settings", patch),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["org-settings"] }),
  });

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
            ארגון
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
            label="מנהלים רשאים לערוך משמרות"
          />

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            העדפות עובדים לפני AI
          </Typography>
          <Stack spacing={2} sx={{ mt: 1, maxWidth: 400 }}>
            <TextField
              label="מינימום ימים קדימה להגשת העדפות"
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
              שמור מרווח
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={!!orgQ.data?.preferenceRemindersEnabled}
                  onChange={(_, v) => patchOrg.mutate({ preferenceRemindersEnabled: v })}
                  disabled={orgQ.isLoading || patchOrg.isPending}
                />
              }
              label="תזכורות אוטומטיות למלא העדפות"
            />
          </Stack>

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
            הודעת מערכת (לכל המחוברים)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            שידור בזמן אמת למשתמשים מחוברים עם מגבלת תדירות.
          </Typography>
          <Stack spacing={2} sx={{ maxWidth: 560 }}>
            {systemBroadcast.isError ? (
              <Alert severity="error">
                {(systemBroadcast.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                  "לא ניתן לשדר"}
              </Alert>
            ) : null}
            {systemBroadcast.isSuccess ? <Alert severity="success">נשלח</Alert> : null}
            <TextField
              label="כותרת"
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
              label="הודעה"
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
              <InputLabel id="sys-bc-severity">חומרה</InputLabel>
              <Select
                labelId="sys-bc-severity"
                label="חומרה"
                value={bcSeverity}
                onChange={(e) => {
                  setBcSeverity(e.target.value as "info" | "warning" | "error");
                  systemBroadcast.reset();
                }}
              >
                <MenuItem value="info">מידע</MenuItem>
                <MenuItem value="warning">אזהרה</MenuItem>
                <MenuItem value="error">שגיאה</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              disabled={
                systemBroadcast.isPending || bcTitle.trim().length === 0 || bcMessage.trim().length === 0
              }
              onClick={() => systemBroadcast.mutate()}
            >
              שלח לכל המחוברים
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
