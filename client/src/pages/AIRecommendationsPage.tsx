import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  GlobalStyles,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import AIIcon from "@mui/icons-material/AutoAwesome";
import WarningIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { useAuth, useRole } from "../store/authContext";
import { useAiSmartAlerts } from "../hooks/useAiSmartAlerts";
import type { SmartAlert } from "../utils/aiSmartAlerts";
import { AI_ALERTS_SIGNATURE_SEEN_KEY, MANAGER_OFFICE_COVERAGE_ALERT_ID } from "../utils/aiSmartAlerts";

type RecommendResult = {
  recommendations: Array<{ date: string; employeeId: string; recommendedStatus: string; reason?: string }>;
  confidence?: number;
  model?: string;
  validation?: { ok: true } | { ok: false; errors: string[] };
  preferenceContext?: {
    submittedPreferenceDocuments: number;
    employeesWithSubmittedPrefs: number;
    employeeDaysWithPreference: number;
  };
  preferenceVsRecommendation?: {
    recommendationRows: number;
    matchedPreference: number;
    differsFromPreference: number;
    noSubmittedPreferenceForSlot: number;
    differsSamples: Array<{
      employeeId: string;
      date: string;
      submittedPreference: string;
      recommendedStatus: string;
    }>;
  };
};

export default function AIRecommendationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = useRole();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const { alerts, loading, signature, refetch } = useAiSmartAlerts(role !== "employee");

  const managerCoverageAlert = useMemo(
    () => alerts.find((a) => a.id === MANAGER_OFFICE_COVERAGE_ALERT_ID),
    [alerts]
  );

  useEffect(() => {
    if (role === "employee") return;
    if (loading) return;
    try {
      window.localStorage.setItem(AI_ALERTS_SIGNATURE_SEEN_KEY, signature);
    } catch {
      /* ignore quota / private mode */
    }
  }, [role, loading, signature]);
  const [showRecForm, setShowRecForm] = useState(false);
  const [dept, setDept] = useState("");
  const [loc, setLoc] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minOffice, setMinOffice] = useState(3);
  const [cap, setCap] = useState(50);
  /** אישור אדמין בכיר לאפשר ה-AI למליץ במשרד בשישי–שבת (UTC). */
  const [allowFridaySaturdayOffice, setAllowFridaySaturdayOffice] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (role !== "manager" || !user?.departmentId || dept) return;
    setDept(user.departmentId);
  }, [role, user?.departmentId, dept]);

  const departmentsQ = useQuery({
    queryKey: ["departments-for-ai"],
    queryFn: async () => (await api.get<{ items: { id: string; name: string }[] }>("/api/departments")).data.items,
  });
  const locationsQ = useQuery({
    queryKey: ["locations-for-ai"],
    queryFn: async () => (await api.get<{ items: { id: string; name: string }[] }>("/api/locations")).data.items,
  });

  const recommendMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/api/ai/recommend-schedule", {
        departmentId: dept,
        locationId: loc,
        dateRange: { from, to },
        constraints: {
          minOfficeEmployeesPerDay: minOffice,
          maxOfficeCapacity: cap,
          preferredOfficeDays: ["Monday", "Wednesday"],
        },
        ...(role === "admin" && allowFridaySaturdayOffice ? { allowFridaySaturdayOffice: true } : {}),
      });
      return data;
    },
    onSuccess: (data) => setResult(data),
    onError: (err) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t("error");
      setToast({ msg, ok: false });
    },
  });

  const validationBlocksApprove = result?.validation?.ok === false;
  const canApproveAi = role === "admin" || role === "manager";

  const approveMut = useMutation({
    mutationFn: async () => {
      if (!result) return;
      await api.post("/api/ai/approve-recommendations", {
        departmentId: dept,
        locationId: loc,
        recommendations: result.recommendations,
        confidence: result.confidence,
        model: result.model,
      });
    },
    onSuccess: () => {
      setToast({ msg: t("success"), ok: true });
      void queryClient.invalidateQueries({ queryKey: ["schedules-all"] });
      void queryClient.invalidateQueries({ queryKey: ["schedules-recent"] });
      void queryClient.invalidateQueries({ queryKey: ["employees-all-for-ai"] });
      void queryClient.invalidateQueries({ queryKey: ["schedules-forward-parking"] });
      void queryClient.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      void queryClient.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: () => setToast({ msg: t("error"), ok: false }),
  });

  if (role === "employee") {
    return <Alert severity="info">אין גישה לעמוד זה</Alert>;
  }

  const ManagerCovIcon = managerCoverageAlert?.Icon;

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", position: "relative" }}>
      <GlobalStyles
        styles={{
          "@keyframes sytAiHeaderShimmer": {
            "0%": { backgroundPosition: "0% 50%" },
            "100%": { backgroundPosition: "200% 50%" },
          },
          "@keyframes sytAiRowIn": {
            "0%": { opacity: 0, transform: "translateY(10px)" },
            "100%": { opacity: 1, transform: "translateY(0)" },
          },
          "@keyframes sytAiOrbDrift": {
            "0%, 100%": { transform: "translate(0, 0) scale(1)" },
            "50%": { transform: "translate(12px, -8px) scale(1.05)" },
          },
        }}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <AIIcon color="primary" />
          <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("ai")}
          </Typography>
        </Stack>
        <Tooltip title="רענן" arrow>
          <IconButton onClick={() => void refetch()}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mb: 3,
          maxWidth: 720,
          lineHeight: 1.65,
        }}
      >
        {t("aiAlertsSubtitle")}
      </Typography>

      {managerCoverageAlert ? (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 900 }}>
          <Stack spacing={1.25} alignItems="flex-start">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "error.main" }}>
              {ManagerCovIcon ? <ManagerCovIcon fontSize="small" /> : null}
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: "text.primary" }}>
                {managerCoverageAlert.title}
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={600}>
              {t("aiManagerOfficeCoveragePolicyLead")}
            </Typography>
            <Typography variant="body2">{managerCoverageAlert.detail}</Typography>
            <Button size="small" variant="contained" color="inherit" component={RouterLink} to="/schedules">
              {t("managerOfficeCoverageGoSchedules")}
            </Button>
          </Stack>
        </Alert>
      ) : null}

      {/* Alerts section */}
      <Card
        sx={{
          mb: 3,
          position: "relative",
          overflow: "hidden",
          border: "1px solid",
          borderColor: alpha(theme.palette.warning.main, 0.35),
          background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.92)} 0%, ${alpha(
            theme.palette.warning.main,
            0.06
          )} 55%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          backdropFilter: "blur(10px)",
          boxShadow: `0 20px 48px -24px ${alpha(theme.palette.common.black, 0.35)}`,
          transition: "box-shadow 0.35s ease, transform 0.35s ease",
          "&:hover": {
            boxShadow: `0 28px 56px -20px ${alpha(theme.palette.warning.main, 0.25)}`,
          },
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: -1,
            pointerEvents: "none",
            opacity: 0.55,
            background: `radial-gradient(circle at 12% 18%, ${alpha(theme.palette.secondary.main, 0.22)} 0%, transparent 42%),
              radial-gradient(circle at 88% 8%, ${alpha(theme.palette.primary.main, 0.2)} 0%, transparent 38%)`,
            animation: "sytAiOrbDrift 14s ease-in-out infinite",
          }}
        />
        <CardContent sx={{ position: "relative", zIndex: 1 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.5}
            sx={{ mb: 2, flexWrap: "wrap", rowGap: 1.5 }}
          >
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette.warning.main, 0.2),
                color: "warning.main",
                boxShadow: `0 8px 24px -8px ${alpha(theme.palette.warning.main, 0.5)}`,
                animation: "sytAiOrbDrift 8s ease-in-out infinite reverse",
              }}
            >
              <WarningIcon />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography
                variant="h6"
                fontWeight={800}
                sx={{
                  background: `linear-gradient(90deg, ${theme.palette.text.primary}, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.text.primary})`,
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "sytAiHeaderShimmer 8s linear infinite",
                }}
              >
                {t("aiAlerts")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                לוח שיבוצים (30 יום אחרונים), חגים קרובים, תחזית גשם בסיסית, והתראות חניה
              </Typography>
            </Box>
            <Chip
              label={alerts.length}
              color={alerts.length > 0 ? "warning" : "success"}
              sx={{ fontWeight: 800, boxShadow: alerts.length > 0 ? `0 0 0 2px ${alpha(theme.palette.warning.main, 0.25)}` : undefined }}
            />
          </Stack>

          {loading ? (
            <LinearProgress />
          ) : alerts.length === 0 ? (
            <Alert severity="success" variant="outlined">
              {t("aiNoAlerts")}
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {alerts.map((a, i) => (
                <AlertRow key={a.id} alert={a} index={i} />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Server-side AI recommendation flow */}
      <Card
        sx={{
          border: "1px solid",
          borderColor: alpha(theme.palette.primary.main, 0.2),
          background: alpha(theme.palette.background.paper, 0.85),
          backdropFilter: "blur(8px)",
          transition: "transform 0.3s ease, box-shadow 0.3s ease",
          "&:hover": {
            boxShadow: `0 16px 40px -24px ${alpha(theme.palette.primary.main, 0.35)}`,
          },
        }}
      >
        <CardContent>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setShowRecForm((s) => !s)}
            sx={{ cursor: "pointer", flexWrap: "wrap", gap: 1, rowGap: 1 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.16), color: "primary.main" }}>
                <AIIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {t("generateRecommendations")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ההמלצות לא יוחלו בלי אישור — מנהל מערכת או מנהל מחלקה (רק למחלקתו).
                </Typography>
              </Box>
            </Stack>
            <IconButton>{showRecForm ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
          </Stack>

          <Collapse in={showRecForm}>
            <Divider sx={{ my: 2 }} />
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              <TextField
                select
                label="מחלקה"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                {(departmentsQ.data ?? []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t("locations")}
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
              >
                {(locationsQ.data ?? []).map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </TextField>
              <Box />
              <TextField
                type="date"
                label="מ"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <TextField
                type="date"
                label="עד"
                InputLabelProps={{ shrink: true }}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <Box />
              <TextField
                type="number"
                label="מינימום במשרד ליום"
                value={minOffice}
                onChange={(e) => setMinOffice(Number(e.target.value))}
              />
              <TextField
                type="number"
                label="קיבולת מקסימלית"
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
              />
              {role === "admin" ? (
                <Box sx={{ gridColumn: "1 / -1" }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={allowFridaySaturdayOffice}
                        onChange={(e) => setAllowFridaySaturdayOffice(e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {t("aiWeekendOfficeAdminOverride")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("aiWeekendOfficeAdminOverrideHint")}
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              ) : null}
              <Button
                variant="contained"
                size="large"
                disabled={recommendMut.isPending || !dept || !loc || !from || !to}
                onClick={() => recommendMut.mutate()}
                startIcon={<AIIcon />}
              >
                {recommendMut.isPending ? t("analyzing") : "הפק המלצות"}
              </Button>
            </Box>

            {result && (
              <Box sx={{ mt: 3 }}>
                {result.validation?.ok === false ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("aiValidationBlocked")}
                    </Typography>
                    <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                      {result.validation.errors.map((e, i) => (
                        <Typography key={i} component="li" variant="body2">
                          {e}
                        </Typography>
                      ))}
                    </Stack>
                  </Alert>
                ) : null}
                {result.preferenceContext ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("aiPreferenceContextTitle")}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      {t("aiPreferenceContextBody", {
                        docs: result.preferenceContext.submittedPreferenceDocuments,
                        employees: result.preferenceContext.employeesWithSubmittedPrefs,
                        days: result.preferenceContext.employeeDaysWithPreference,
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("aiPreferenceContextFootnote")}
                    </Typography>
                  </Alert>
                ) : null}
                {result.preferenceVsRecommendation && result.preferenceVsRecommendation.recommendationRows > 0 ? (
                  <Alert
                    severity={result.preferenceVsRecommendation.differsFromPreference > 0 ? "warning" : "success"}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      {t("aiPreferenceAlignmentTitle")}
                    </Typography>
                    <Typography variant="body2">
                      {t("aiPreferenceAlignmentBody", {
                        matched: result.preferenceVsRecommendation.matchedPreference,
                        differs: result.preferenceVsRecommendation.differsFromPreference,
                        none: result.preferenceVsRecommendation.noSubmittedPreferenceForSlot,
                        total: result.preferenceVsRecommendation.recommendationRows,
                      })}
                    </Typography>
                    {result.preferenceVsRecommendation.differsSamples.length > 0 ? (
                      <Stack component="ul" sx={{ m: 0, mt: 1, pl: 2 }}>
                        {result.preferenceVsRecommendation.differsSamples.map((s, i) => (
                          <Typography key={i} component="li" variant="caption" sx={{ display: "list-item" }}>
                            {s.date} · …{s.employeeId.slice(-6)} · {t("aiPreferenceHad")}: {t(s.submittedPreference)}{" "}
                            · {t("aiPreferenceRecommended")}: {t(s.recommendedStatus)}
                          </Typography>
                        ))}
                      </Stack>
                    ) : null}
                  </Alert>
                ) : null}
                <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
                  <Chip label={`רמת ביטחון: ${result.confidence ?? "—"}`} color="primary" />
                  <Chip label={`מודל: ${result.model ?? "—"}`} variant="outlined" />
                  {result.validation?.ok === true ? (
                    <Chip label={t("aiValidationOk")} color="success" size="small" variant="outlined" />
                  ) : null}
                </Stack>
                <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <Table size="small" sx={{ minWidth: 520 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>תאריך</TableCell>
                        <TableCell>עובד</TableCell>
                        <TableCell>סטטוס</TableCell>
                        <TableCell>סיבה</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.recommendations.slice(0, 50).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.employeeId.slice(-6)}</TableCell>
                          <TableCell>{t(r.recommendedStatus)}</TableCell>
                          <TableCell sx={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: 280 }}>
                            {r.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
                {canApproveAi && (
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    color="warning"
                    disabled={approveMut.isPending || validationBlocksApprove || !result.recommendations.length}
                    onClick={() => approveMut.mutate()}
                  >
                    אישור והחלה — יעדכן משמרות וישלח התראות
                  </Button>
                )}
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)}>
        <Alert severity={toast?.ok ? "success" : "error"} onClose={() => setToast(null)}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function AlertRow({ alert, index }: { alert: SmartAlert; index: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [groupOpen, setGroupOpen] = useState(false);
  const sevColor =
    alert.severity === "error"
      ? theme.palette.error.main
      : alert.severity === "warning"
        ? theme.palette.warning.main
        : theme.palette.info.main;
  const hasGroup = (alert.groupMembers?.length ?? 0) > 0;
  const isManagerCoverage = alert.id === MANAGER_OFFICE_COVERAGE_ALERT_ID;
  const RowIcon = alert.Icon;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        p: 1.75,
        borderRadius: 2,
        flexWrap: "wrap",
        rowGap: 1,
        bgcolor: alpha(sevColor, 0.07),
        borderInlineStart: `4px solid ${sevColor}`,
        boxShadow: `0 4px 18px -12px ${alpha(sevColor, 0.45)}`,
        opacity: 0,
        animation: `sytAiRowIn 0.45s ease forwards`,
        animationDelay: `${Math.min(index, 8) * 0.06}s`,
        transition: "transform 0.28s ease, box-shadow 0.28s ease, background-color 0.28s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          bgcolor: alpha(sevColor, 0.12),
          boxShadow: `0 12px 28px -14px ${alpha(sevColor, 0.55)}`,
        },
      }}
    >
      <Avatar sx={{ bgcolor: alpha(alert.color, 0.18), color: alert.color, flexShrink: 0 }}>
        <RowIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {isManagerCoverage ? (
          <>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: sevColor, wordBreak: "break-word" }}>
              {alert.title}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75, wordBreak: "break-word" }}>
              {t("aiManagerOfficeCoveragePolicyLead")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word", mt: 0.75, whiteSpace: "pre-line" }}>
              {alert.detail}
            </Typography>
          </>
        ) : (
          <>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ rowGap: 0.75 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
                {alert.employeeName}
              </Typography>
              <Chip
                size="small"
                label={alert.title}
                sx={{
                  bgcolor: alpha(sevColor, 0.16),
                  color: sevColor,
                  fontWeight: 700,
                }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word", mt: 0.25 }}>
              {alert.detail}
            </Typography>
          </>
        )}
        {hasGroup ? (
          <Box sx={{ mt: 1 }}>
            <Button size="small" variant="text" onClick={() => setGroupOpen((o) => !o)} sx={{ fontWeight: 700 }}>
              {groupOpen ? t("aiGroupCollapseList") : t("aiGroupExpandList")}
            </Button>
            <Collapse in={groupOpen}>
              <List dense disablePadding sx={{ mt: 0.5, pl: 0 }}>
                {(alert.groupMembers ?? []).map((m) => (
                  <ListItem key={m.employeeId} disableGutters sx={{ py: 0.25 }}>
                    <ListItemText primary={m.employeeName} primaryTypographyProps={{ variant: "body2" }} />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}
