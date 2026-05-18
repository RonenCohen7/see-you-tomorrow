import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { locationsPickerUrl } from "../utils/referencePickerUrls";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export type RuleType = "location_unavailable" | "min_managers_office_daily" | "manager_office_auto_parking";

export type SchedulingRuleDto = {
  id: string;
  ruleType: RuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  createdAt?: string;
};

export type SchedulingRuleAiDraft = {
  ruleType: RuleType;
  payload: Record<string, unknown>;
  explanationHebrew: string;
  explanationEn?: string;
};

export type SchedulingRuleProposalDto = {
  id: string;
  status: "pending" | "approved" | "rejected";
  ruleType: RuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  explanationHe: string;
  explanationEn?: string;
  conflictingRuleIds: string[];
  createdBy: string;
  createdAt?: string;
};

const RULE_TYPE_ORDER: RuleType[] = [
  "location_unavailable",
  "min_managers_office_daily",
  "manager_office_auto_parking",
];

type DraftSchedulingAnalyzeResponse =
  | { outcome: "scheduling_rule"; draft: SchedulingRuleAiDraft }
  | {
      outcome: "maintenance_action";
      action: "CLEAR_INACTIVE_FUTURE_SCHEDULES";
      explanationHebrew: string;
    };

type Loc = { id: string; name: string };

const objectIdRegex = /^[a-f\d]{24}$/i;

function ensureItems<T>(items: unknown): T[] {
  return Array.isArray(items) ? (items as T[]) : [];
}

function formatRulePayload(rule: SchedulingRuleDto, locationNameById: Map<string, string>): string {
  if (rule.ruleType === "location_unavailable") {
    const p = rule.payload;
    const lid = typeof p.locationId === "string" ? p.locationId : "";
    const from = typeof p.effectiveFrom === "string" ? p.effectiveFrom : "";
    const to = typeof p.effectiveTo === "string" ? p.effectiveTo : "";
    const note = typeof p.note === "string" ? p.note : "";
    const name = locationNameById.get(lid) ?? (lid.length >= 8 ? `${lid.slice(0, 8)}…` : lid);
    const range = to ? `${from} → ${to}` : from;
    return [name, range, note].filter(Boolean).join(" · ");
  }
  if (rule.ruleType === "min_managers_office_daily") {
    const n = rule.payload.minManagers;
    return typeof n === "number" ? String(n) : "";
  }
  if (rule.ruleType === "manager_office_auto_parking") {
    return "";
  }
  return "";
}

function chipLabel(ruleType: SchedulingRuleDto["ruleType"], tfn: (key: string) => string): string {
  if (ruleType === "location_unavailable") return tfn("schedulingRulesRuleType_location_unavailable");
  if (ruleType === "min_managers_office_daily") return tfn("schedulingRulesRuleType_min_managers_office_daily");
  return tfn("schedulingRulesRuleType_manager_office_auto_parking");
}

function typeIntroKey(ruleType: RuleType): string {
  return `schedulingRulesTypeIntro_${ruleType}`;
}

function impactChipLabels(ruleType: RuleType, tfn: (key: string) => string): string[] {
  if (ruleType === "manager_office_auto_parking") return [tfn("schedulingRulesImpactParking")];
  return [tfn("schedulingRulesImpactAi")];
}

function draftExplanation(draft: SchedulingRuleAiDraft, locale: string): string {
  if (locale.startsWith("en") && draft.explanationEn?.trim()) return draft.explanationEn.trim();
  return draft.explanationHebrew;
}

export default function SchedulingRulesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [toast, setToast] = React.useState<{ msg: string; ok: boolean } | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [rlLocationId, setRlLocationId] = React.useState("");
  const [rlFrom, setRlFrom] = React.useState("");
  const [rlTo, setRlTo] = React.useState("");
  const [rlNote, setRlNote] = React.useState("");
  const [mmValue, setMmValue] = React.useState<number>(1);
  const [wizText, setWizText] = React.useState("");
  const [wizDraft, setWizDraft] = React.useState<SchedulingRuleAiDraft | null>(null);
  const [wizMaintenance, setWizMaintenance] = React.useState<{ explanationHebrew: string } | null>(null);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = React.useState(false);
  const [wizActive, setWizActive] = React.useState(true);
  const [savingWizard, setSavingWizard] = React.useState(false);
  const [searchParams] = useSearchParams();
  const highlightProposalId = searchParams.get("proposalId")?.trim() || undefined;

  const rulesQ = useQuery({
    queryKey: ["scheduling-rules"],
    queryFn: async () =>
      ensureItems<SchedulingRuleDto>(
        (await api.get<{ items?: unknown }>("/api/schedules/scheduling-rules")).data.items
      ),
    refetchOnMount: "always",
  });

  const rulesRows = React.useMemo(() => ensureItems<SchedulingRuleDto>(rulesQ.data), [rulesQ.data]);

  const proposalsQ = useQuery({
    queryKey: ["scheduling-rule-proposals", "pending"],
    queryFn: async () =>
      ensureItems<SchedulingRuleProposalDto>(
        (await api.get<{ items?: unknown }>("/api/schedules/scheduling-rules/proposals?status=pending")).data
          .items
      ),
    refetchOnMount: "always",
  });

  const pendingProposals = React.useMemo(
    () => ensureItems<SchedulingRuleProposalDto>(proposalsQ.data),
    [proposalsQ.data]
  );

  const groupedRules = React.useMemo(
    () =>
      RULE_TYPE_ORDER.map((ruleType) => ({
        ruleType,
        rules: rulesRows.filter((r) => r.ruleType === ruleType),
      })).filter((g) => g.rules.length > 0),
    [rulesRows]
  );

  const hasAutoParkingRule = React.useMemo(
    () => rulesRows.some((r) => r.ruleType === "manager_office_auto_parking"),
    [rulesRows]
  );

  const locationsQ = useQuery({
    queryKey: ["locations"],
    queryFn: async () =>
      ensureItems<Loc>((await api.get<{ items?: unknown }>(locationsPickerUrl())).data.items),
    refetchOnMount: "always",
  });

  const locationRows = React.useMemo(() => ensureItems<Loc>(locationsQ.data), [locationsQ.data]);

  const locationNameById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locationRows) m.set(l.id, l.name);
    return m;
  }, [locationRows]);

  const patchMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/schedules/scheduling-rules/${id}`, { isActive }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["scheduling-rules"] }),
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/schedules/scheduling-rules/${id}`),
    onSuccess: async () => {
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      setToast({ ok: true, msg: t("success") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const analyzeMut = useMutation({
    mutationFn: async () =>
      api.post<DraftSchedulingAnalyzeResponse>("/api/ai/draft-scheduling-rule", {
        naturalText: wizText.trim(),
        locations: locationRows.map((l) => ({ id: l.id, name: l.name })),
      }),
    onSuccess: (resp) => {
      const data = resp.data;
      if (data.outcome === "maintenance_action") {
        setWizDraft(null);
        setWizMaintenance({ explanationHebrew: data.explanationHebrew });
        setToast({ ok: true, msg: t("schedulingRulesMaintenanceDetectedToast") });
        return;
      }
      setWizMaintenance(null);
      setWizDraft(data.draft);
      setToast({ ok: true, msg: t("success") });
    },
    onError: (e) =>
      setToast({
        ok: false,
        msg: apiErrorMessage(e, t("error")),
      }),
  });

  const purgeInactiveMut = useMutation({
    mutationFn: async () =>
      api.post<{ deletedSchedulesCount: number; inactiveEmployeeIdsCount: number }>(
        "/api/schedules/admin/maintenance/inactive-employees-clear-future"
      ),
    onSuccess: async (resp) => {
      setMaintenanceConfirmOpen(false);
      setWizMaintenance(null);
      setWizText("");
      setToast({
        ok: true,
        msg: t("schedulingRulesMaintenanceSuccessToast", {
          deletedSchedules: resp.data.deletedSchedulesCount,
          inactiveEmployees: resp.data.inactiveEmployeeIdsCount,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      await qc.invalidateQueries({ queryKey: ["schedules-all"] });
      await qc.invalidateQueries({ queryKey: ["schedules-recent"] });
      await qc.invalidateQueries({ queryKey: ["schedules-forward-parking"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-coverage"] });
      await qc.invalidateQueries({ queryKey: ["schedules-manager-month"] });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const createLocRuleMut = useMutation({
    mutationFn: async () =>
      api.post("/api/schedules/scheduling-rules", {
        ruleType: "location_unavailable",
        payload: {
          locationId: rlLocationId.trim(),
          effectiveFrom: rlFrom,
          ...(rlTo.trim() ? { effectiveTo: rlTo.trim() } : {}),
          ...(rlNote.trim() ? { note: rlNote.trim() } : {}),
        },
      }),
    onSuccess: async () => {
      setRlFrom("");
      setRlTo("");
      setRlNote("");
      setRlLocationId("");
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      setToast({ ok: true, msg: t("success") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const createAutoParkingMut = useMutation({
    mutationFn: async () =>
      api.post("/api/schedules/scheduling-rules", {
        ruleType: "manager_office_auto_parking",
        payload: {},
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      setToast({ ok: true, msg: t("success") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const createManagersRuleMut = useMutation({
    mutationFn: async () =>
      api.post("/api/schedules/scheduling-rules", {
        ruleType: "min_managers_office_daily",
        payload: { minManagers: mmValue },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      setToast({ ok: true, msg: t("success") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const approveProposalMut = useMutation({
    mutationFn: async (id: string) =>
      api.post(`/api/schedules/scheduling-rules/proposals/${id}/approve`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      await qc.invalidateQueries({ queryKey: ["scheduling-rule-proposals"] });
      setToast({ ok: true, msg: t("schedulingRulesProposalApproved") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const rejectProposalMut = useMutation({
    mutationFn: async (id: string) =>
      api.post(`/api/schedules/scheduling-rules/proposals/${id}/reject`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduling-rule-proposals"] });
      setToast({ ok: true, msg: t("schedulingRulesProposalRejected") });
    },
    onError: (e) => setToast({ ok: false, msg: apiErrorMessage(e, t("error")) }),
  });

  const onSaveWizardClicked = React.useCallback(async () => {
    if (!wizDraft) {
      setToast({ ok: false, msg: t("schedulingRulesWizardNeedDraft") });
      return;
    }
    try {
      setSavingWizard(true);
      const locale = i18n.language.startsWith("en") ? "en" : "he";
      const { data } = await api.post<
        | { outcome: "created"; rule: SchedulingRuleDto }
        | { outcome: "proposal"; proposal: SchedulingRuleProposalDto }
      >("/api/schedules/scheduling-rules/submit", {
        ruleType: wizDraft.ruleType,
        payload: wizDraft.payload,
        isActive: wizActive,
        explanationHe: wizDraft.explanationHebrew,
        explanationEn: wizDraft.explanationEn,
        locations: locationRows.map((l) => ({ id: l.id, name: l.name })),
      });
      setWizDraft(null);
      setWizText("");
      await qc.invalidateQueries({ queryKey: ["scheduling-rules"] });
      await qc.invalidateQueries({ queryKey: ["scheduling-rule-proposals"] });
      setToast({
        ok: true,
        msg: data.outcome === "created" ? t("success") : t("schedulingRulesProposalSent"),
      });
    } catch (e) {
      setToast({ ok: false, msg: apiErrorMessage(e, t("error")) });
    } finally {
      setSavingWizard(false);
    }
  }, [i18n.language, locationRows, t, wizActive, wizDraft]);

  const localeTag = i18n.language === "en" ? "en-GB" : "he-IL";
  const canAddLocation =
    objectIdRegex.test(rlLocationId.trim()) && rlFrom.length >= 8 && !createLocRuleMut.isPending;

  return (
    <Box sx={{ width: "100%", maxWidth: 900, minWidth: 0, boxSizing: "border-box", mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("schedulingRulesPageTitle")}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        {t("schedulingRulesManualSaveNote")}
      </Alert>

      <Typography variant="h6" gutterBottom>
        {t("schedulingRulesPendingTitle")}
      </Typography>
      {proposalsQ.isLoading ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("loading")}
        </Typography>
      ) : pendingProposals.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {t("schedulingRulesPendingEmpty")}
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mb: 3 }}>
          {pendingProposals.map((p) => {
            const highlighted = highlightProposalId && p.id.endsWith(highlightProposalId);
            return (
              <Card
                key={p.id}
                variant="outlined"
                sx={{
                  borderColor: highlighted ? "warning.main" : undefined,
                  borderWidth: highlighted ? 2 : 1,
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip size="small" label={chipLabel(p.ruleType, t)} color="warning" />
                      {impactChipLabels(p.ruleType, t).map((lbl) => (
                        <Chip key={lbl} size="small" variant="outlined" label={lbl} />
                      ))}
                    </Stack>
                    <Typography variant="body2">
                      {formatRulePayload(
                        { ...p, id: p.id, priority: 0, isActive: p.isActive },
                        locationNameById
                      ) || draftExplanation(
                        {
                          ruleType: p.ruleType,
                          payload: p.payload,
                          explanationHebrew: p.explanationHe,
                          explanationEn: p.explanationEn,
                        },
                        i18n.language
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {draftExplanation(
                        {
                          ruleType: p.ruleType,
                          payload: p.payload,
                          explanationHebrew: p.explanationHe,
                          explanationEn: p.explanationEn,
                        },
                        i18n.language
                      )}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={approveProposalMut.isPending || rejectProposalMut.isPending}
                        onClick={() => approveProposalMut.mutate(p.id)}
                      >
                        {t("schedulingRulesApproveProposal")}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        disabled={approveProposalMut.isPending || rejectProposalMut.isPending}
                        onClick={() => rejectProposalMut.mutate(p.id)}
                      >
                        {t("schedulingRulesRejectProposal")}
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t("schedulingRulesWizardTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("schedulingRulesWizardHint")}
        </Typography>
        <TextField
          placeholder={t("schedulingRulesWizardPlaceholder")}
          value={wizText}
          onChange={(e) => {
            setWizText(e.target.value);
            setWizDraft(null);
            setWizMaintenance(null);
          }}
          fullWidth
          multiline
          minRows={3}
        />
        <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center" flexWrap="wrap">
          <Button
            variant="contained"
            disabled={
              wizText.trim().length < 3 ||
              analyzeMut.isPending ||
              !locationsQ.isSuccess
            }
            onClick={() => analyzeMut.mutate()}
            startIcon={analyzeMut.isPending ? <CircularProgress color="inherit" size={18} /> : undefined}
          >
            {!analyzeMut.isPending ? t("schedulingRulesWizardAnalyze") : t("loading")}
          </Button>
          <Typography variant="caption" color="text.secondary">
            {locationsQ.isLoading ? t("loading") : null}
          </Typography>
        </Stack>

        {wizMaintenance ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom fontWeight={700}>
              {t("schedulingRulesMaintenanceTitle")}
            </Typography>
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t("schedulingRulesMaintenanceDescription")}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("schedulingRulesWizardExplanation")}: {wizMaintenance.explanationHebrew}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="contained" color="warning" onClick={() => setMaintenanceConfirmOpen(true)}>
                {t("schedulingRulesMaintenanceRun")}
              </Button>
              <Button variant="text" onClick={() => setWizMaintenance(null)}>
                {t("cancel")}
              </Button>
            </Stack>
          </>
        ) : null}

        {wizDraft ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom fontWeight={700}>
              {t("schedulingRulesWizardPreviewTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("schedulingRulesWizardExplanation")}: {draftExplanation(wizDraft, i18n.language)}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" label={chipLabel(wizDraft.ruleType, t)} color="primary" variant="outlined" />
              {impactChipLabels(wizDraft.ruleType, t).map((lbl) => (
                <Chip key={lbl} size="small" variant="outlined" label={lbl} />
              ))}
            </Stack>
            <Typography variant="body2" fontWeight={600}>
              {formatRulePayload(
                {
                  id: "",
                  ruleType: wizDraft.ruleType,
                  payload: wizDraft.payload,
                  isActive: wizActive,
                  priority: 0,
                },
                locationNameById
              ) ||
                (wizDraft.ruleType === "manager_office_auto_parking"
                  ? t("schedulingRulesPayloadBehaviourOnly")
                  : "")}
            </Typography>
            <FormControlLabel
              sx={{ mt: 1.5, alignItems: "flex-start" }}
              control={
                <Switch
                  checked={wizActive}
                  onChange={(_, c) => setWizActive(c)}
                />
              }
              label={t("schedulingRulesWizardActiveLabel")}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="secondary"
                disabled={savingWizard}
                onClick={() => void onSaveWizardClicked()}
              >
                {t("schedulingRulesWizardSave")}
              </Button>
              <Button variant="text" onClick={() => setWizDraft(null)}>
                {t("cancel")}
              </Button>
            </Stack>
          </>
        ) : null}
      </Card>

      <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>{t("schedulingRulesHelpSection")}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {t("schedulingRulesIntroP1")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("schedulingRulesIntroP2")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("schedulingRulesIntroP3")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("schedulingRulesIntroP5")}
            </Typography>
            <Alert severity="info">{t("schedulingRulesIntroP4")}</Alert>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
        {t("schedulingRulesListTitle")}
      </Typography>

      {rulesQ.isLoading ? (
        <Typography color="text.secondary">{t("loading")}</Typography>
      ) : rulesQ.isError ? (
        <Alert severity="error">{t("networkError")}</Alert>
      ) : rulesRows.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t("schedulingRulesEmpty")}
        </Typography>
      ) : (
        <Stack spacing={3} sx={{ mb: 4 }}>
          {groupedRules.map(({ ruleType, rules: groupRows }) => (
            <Box key={ruleType}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                {chipLabel(ruleType, t)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t(typeIntroKey(ruleType))}
              </Typography>
              <Stack spacing={1.5}>
                {groupRows.map((r) => {
                  const patching = patchMut.isPending && patchMut.variables?.id === r.id;
                  const created =
                    r.createdAt &&
                    !Number.isNaN(new Date(r.createdAt).getTime()) &&
                    new Date(r.createdAt).toLocaleDateString(localeTag);

                  return (
                    <Card key={r.id} variant="outlined" sx={{ opacity: r.isActive ? 1 : 0.85 }}>
                      <CardContent sx={{ "&:last-child": { pb: 2 }, py: 1.5 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          alignItems={{ xs: "stretch", sm: "center" }}
                          spacing={2}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" flexGrow={1}>
                            {impactChipLabels(r.ruleType, t).map((lbl) => (
                              <Chip key={lbl} size="small" variant="outlined" label={lbl} />
                            ))}
                            <Typography variant="body2" fontWeight={600}>
                              {formatRulePayload(r, locationNameById) ||
                                (r.ruleType === "manager_office_auto_parking"
                                  ? t("schedulingRulesPayloadBehaviourOnly")
                                  : "")}
                            </Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={r.isActive}
                                  disabled={patching}
                                  onChange={(_, checked) =>
                                    patchMut.mutate({ id: r.id, isActive: checked })
                                  }
                                />
                              }
                              label={t("schedulingRulesActiveLabel")}
                              sx={{ m: 0 }}
                            />
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={t("schedulingRulesDeleteAria")}
                              onClick={() => setDeleteId(r.id)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                          {t("schedulingRulesMetaLine", {
                            priority: r.priority,
                            created: created || "—",
                          })}
                        </Typography>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Accordion defaultExpanded={false} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={700}>{t("schedulingRulesAdvancedSection")}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ mt: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={700}>
                {t("schedulingRulesAddLocationSection")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t("schedulingRulesAddLocationHint")}
              </Typography>
              <Stack spacing={1} sx={{ maxWidth: 480 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="srloc">{t("schedulingRulesLocationSelect")}</InputLabel>
                  <Select
                    labelId="srloc"
                    label={t("schedulingRulesLocationSelect")}
                    value={rlLocationId}
                    onChange={(e) => setRlLocationId(e.target.value as string)}
                  >
                    {locationRows.map((loc) => (
                      <MenuItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label={t("schedulingRulesEffectiveFrom")}
                  type="date"
                  size="small"
                  value={rlFrom}
                  onChange={(e) => setRlFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label={t("schedulingRulesEffectiveToOptional")}
                  type="date"
                  size="small"
                  value={rlTo}
                  onChange={(e) => setRlTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label={t("schedulingRulesNoteOptional")}
                  size="small"
                  value={rlNote}
                  onChange={(e) => setRlNote(e.target.value)}
                  fullWidth
                />
                <Button variant="contained" disabled={!canAddLocation} onClick={() => createLocRuleMut.mutate()}>
                  {t("schedulingRulesAddLocationButton")}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight={700}>
                {t("schedulingRulesAddManagersSection")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t("schedulingRulesMinManagersHelp")}
              </Typography>
              <Stack spacing={1} sx={{ maxWidth: 280 }}>
                <TextField
                  label={t("schedulingRulesMinManagersLabel")}
                  type="number"
                  size="small"
                  value={mmValue}
                  onChange={(e) =>
                    setMmValue(Math.min(50, Math.max(0, Number(e.target.value) || 0)))
                  }
                  inputProps={{ min: 0, max: 50 }}
                  fullWidth
                />
                <Button
                  variant="contained"
                  disabled={
                    createManagersRuleMut.isPending || mmValue < 0 || mmValue > 50 || Number.isNaN(mmValue)
                  }
                  onClick={() => createManagersRuleMut.mutate()}
                >
                  {t("schedulingRulesAddManagersButton")}
                </Button>
              </Stack>
            </Box>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ maxWidth: 560 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight={700}>
              {t("schedulingRulesAddAutoParkingSection")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("schedulingRulesAddAutoParkingHint")}
            </Typography>
            {hasAutoParkingRule ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {t("schedulingRulesAutoParkingAlreadyExists")}
              </Alert>
            ) : null}
            <Button
              variant="outlined"
              disabled={hasAutoParkingRule || createAutoParkingMut.isPending}
              onClick={() => createAutoParkingMut.mutate()}
            >
              {t("schedulingRulesAddAutoParkingButton")}
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Dialog
        open={maintenanceConfirmOpen}
        onClose={() => !purgeInactiveMut.isPending && setMaintenanceConfirmOpen(false)}
      >
        <DialogTitle>{t("schedulingRulesMaintenanceConfirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>{t("schedulingRulesMaintenanceConfirmBody")}</Typography>
          {wizMaintenance ? (
            <Typography variant="body2" color="text.secondary">
              {t("schedulingRulesWizardExplanation")}: {wizMaintenance.explanationHebrew}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintenanceConfirmOpen(false)} disabled={purgeInactiveMut.isPending}>
            {t("cancel")}
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={purgeInactiveMut.isPending}
            onClick={() => purgeInactiveMut.mutate()}
            startIcon={purgeInactiveMut.isPending ? <CircularProgress color="inherit" size={18} /> : undefined}
          >
            {t("schedulingRulesMaintenanceRun")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => !deleteMut.isPending && setDeleteId(null)}>
        <DialogTitle>{t("schedulingRulesDeleteConfirmTitle")}</DialogTitle>
        <DialogContent>
          <Typography>{t("schedulingRulesDeleteConfirmBody")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={deleteMut.isPending}>
            {t("cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMut.isPending || !deleteId}
            onClick={() => deleteId && deleteMut.mutate(deleteId)}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast?.msg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
