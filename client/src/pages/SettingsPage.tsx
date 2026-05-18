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

type OrgSettingsResponse = {
  managerCanEditSchedules: boolean;
  preferenceMinDaysAhead: number;
  preferenceRemindersEnabled: boolean;
  customScheduleStatuses: { id: string; labelHe: string; labelEn?: string }[];
};

type OrgSettingsPatch = Partial<{
  managerCanEditSchedules: boolean;
  preferenceMinDaysAhead: number;
  preferenceRemindersEnabled: boolean;
  customScheduleStatuses: { id?: string; labelHe: string; labelEn?: string }[];
}>;

/** Local row: `labelEn` always string for controlled TextField even when omitted on wire. */
type CustomDraftRow = { id: string; labelHe: string; labelEn: string };

function toCustomDraft(rows: OrgSettingsResponse["customScheduleStatuses"] | undefined): CustomDraftRow[] {
  return (rows ?? []).map((r) => ({ id: r.id, labelHe: r.labelHe, labelEn: r.labelEn ?? "" }));
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
  const hasHydratedCustomDraftRef = React.useRef(false);

  React.useEffect(() => {
    if (!orgQ.isSuccess || !orgQ.data || hasHydratedCustomDraftRef.current) return;
    hasHydratedCustomDraftRef.current = true;
    setDraftCustomStatuses(toCustomDraft(orgQ.data.customScheduleStatuses));
  }, [orgQ.isSuccess, orgQ.data]);

  const patchOrg = useMutation({
    mutationFn: async (patch: OrgSettingsPatch) =>
      (await api.patch<OrgSettingsResponse>("/api/schedules/org-settings", patch)).data,
    onSuccess: async (updated) => {
      if (Array.isArray(updated.customScheduleStatuses)) {
        setDraftCustomStatuses(toCustomDraft(updated.customScheduleStatuses));
      }
      await qc.invalidateQueries({ queryKey: ["org-settings"] });
    },
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

          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            סטטוסי משמרת נוספים (מותאמים לארגון)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            מתווספים ליד הסטטוסים המוגדרים במערכת (משרד, בית, חופשה, מחלה, לא עובדים). בשמירה, משמרות שכבר משתמשות
            בסטטוס שנמחק לא ייעלמו — צריך לעדכן אותן ידנית.
          </Typography>
          <Stack spacing={1.25} sx={{ maxWidth: 640, mb: 2 }}>
            {draftCustomStatuses.map((row, idx) => (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} key={row.id || `new-${idx}`}>
                <TextField
                  label="כותרת בעברית"
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
                  label="English (לא חובה)"
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
                <IconButton
                  aria-label="הסרת סטטוס"
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
                setDraftCustomStatuses((cur) => [...cur, { id: "", labelHe: "", labelEn: "" }])
              }
            >
              הוספת סטטוס
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={patchOrg.isPending || draftCustomStatuses.some((r) => !r.labelHe.trim())}
              onClick={() => {
                const payload = draftCustomStatuses.map((row) => {
                  const trimmedId = row.id.trim();
                  const labelHe = row.labelHe.trim();
                  const en = row.labelEn.trim();
                  const base =
                    trimmedId === ""
                      ? { labelHe }
                      : { id: trimmedId, labelHe };
                  return en !== "" ? { ...base, labelEn: en } : base;
                });
                patchOrg.mutate({ customScheduleStatuses: payload });
              }}
            >
              שמור סטטוסים מותאמים
            </Button>
          </Stack>
          {patchOrg.isError ? (
            <Alert severity="error" sx={{ maxWidth: 640, mb: 2 }}>
              {(patchOrg.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "שמירת סטטוסים נכשלה"}
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
