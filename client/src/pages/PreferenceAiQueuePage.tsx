import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { alpha, useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { departmentsPickerUrl } from "../utils/referencePickerUrls";
import type { Employee } from "../types/models";
import { useRole } from "../store/authContext";
import { preferenceAiQueueDisplayNotes } from "../utils/preferenceAiQueueDisplayNotes";
import { utcWeekdayShort } from "../utils/israeliWeek";
import { appIntlLocale, type AppLocale } from "../locale/localeConstants";

type ProposedPipelineItem = {
  date: string;
  employeeId: string;
  recommendedStatus: string;
  reason?: string;
  preferenceSource?: "employee" | "none";
};

type AiBatchPublic = {
  id: string;
  departmentId: string;
  locationId?: string;
  dateRange: { from: string; to: string };
  proposedItems: ProposedPipelineItem[];
  status: string;
  creationSource?: string;
  model?: string;
};

export default function PreferenceAiQueuePage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const role = useRole();

  const deptsQ = useQuery({
    queryKey: ["departments-ai-queue"],
    queryFn: async () =>
      (await api.get<{ items: { id: string; name: string }[] }>(departmentsPickerUrl())).data.items,
    enabled: role === "admin",
  });

  const deptNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of deptsQ.data ?? []) m.set(d.id, d.name);
    return m;
  }, [deptsQ.data]);

  const batchQ = useQuery({
    queryKey: ["ai-batches-pending-pipeline-all"],
    queryFn: async () =>
      (await api.get<{ items: AiBatchPublic[] }>("/api/schedules/ai-batches/pending-pipeline"))
        .data.items,
    enabled: role === "admin" || role === "manager",
    refetchInterval: 30_000,
  });

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const approveMut = useMutation({
    mutationFn: async (batch: AiBatchPublic) => {
      if (!batch.locationId) throw new Error("missingLocation");
      await api.post("/api/ai/approve-recommendations", {
        departmentId: batch.departmentId,
        locationId: batch.locationId,
        aiBatchId: batch.id,
        recommendations: batch.proposedItems.map((p) => ({
          date: p.date,
          employeeId: p.employeeId,
          recommendedStatus: p.recommendedStatus,
          reason: p.reason,
        })),
      });
    },
    onSuccess: async () => {
      setToast({ ok: true, msg: t("success") });
      setExpandedId(null);
      await qc.invalidateQueries({ queryKey: ["ai-batches-pending-pipeline-all"] });
      void qc.invalidateQueries({ queryKey: ["schedules-all"] });
      void qc.invalidateQueries({ queryKey: ["schedules-recent"] });
      void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
      void qc.invalidateQueries({ queryKey: ["parking-spots"] });
    },
    onError: () => setToast({ ok: false, msg: t("error") }),
  });

  const rejectMut = useMutation({
    mutationFn: async (batchId: string) => {
      await api.post(`/api/schedules/ai-batches/${batchId}/reject-pipeline`);
    },
    onSuccess: async () => {
      setToast({ ok: true, msg: t("preferenceAiQueueRejected") });
      setExpandedId(null);
      await qc.invalidateQueries({ queryKey: ["ai-batches-pending-pipeline-all"] });
    },
    onError: () => setToast({ ok: false, msg: t("error") }),
  });

  const headerNote = useMemo(() => {
    if (role === "manager") return t("preferenceAiQueueManagerNote");
    return t("preferenceAiQueueAdminNote");
  }, [role, t]);

  const items = batchQ.data ?? [];

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("preferenceAiQueueTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {headerNote}
      </Typography>

      {batchQ.isLoading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={36} />
        </Stack>
      )}

      {!batchQ.isLoading && items.length === 0 && (
        <Alert severity="success">{t("preferenceAiQueueEmpty")}</Alert>
      )}

      {items.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {t("preferenceAiQueueOpenCount", { count: items.length })}
        </Typography>
      )}

      <Stack spacing={1}>
        {items.map((batch) => {
          const expanded = expandedId === batch.id;
          const deptName = deptNameById.get(batch.departmentId);
          const summary =
            role === "admin" && deptName
              ? t("preferenceAiQueueRequestRow", {
                  dept: deptName,
                  from: batch.dateRange.from,
                  to: batch.dateRange.to,
                })
              : t("preferenceAiQueueRequestRowNoDept", {
                  from: batch.dateRange.from,
                  to: batch.dateRange.to,
                });
          const missingLocation = !batch.locationId;

          return (
            <Card key={batch.id} variant="outlined">
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  px: 2,
                  py: 1.25,
                  cursor: "pointer",
                  bgcolor: expanded
                    ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06)
                    : "transparent",
                  "&:hover": {
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "dark" ? 0.16 : 0.08
                    ),
                  },
                }}
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId((cur) => (cur === batch.id ? null : batch.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId((cur) => (cur === batch.id ? null : batch.id));
                  }
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} noWrap>
                    {summary}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {batch.proposedItems.length} {t("preferenceAiQueueRows")} · …{batch.id.slice(-8)}
                  </Typography>
                </Box>
                {missingLocation && (
                  <Tooltip title={t("preferenceAiQueueMissingLocation") as string}>
                    <WarningAmberIcon color="warning" fontSize="small" />
                  </Tooltip>
                )}
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={
                    batch.status === "pending_manager"
                      ? t("preferenceAiQueueStatusPending")
                      : t(batch.status)
                  }
                />
                <IconButton
                  size="small"
                  aria-label={expanded ? t("preferenceAiQueueCollapseHint") : t("preferenceAiQueueExpandHint")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId((cur) => (cur === batch.id ? null : batch.id));
                  }}
                >
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Stack>
              <Collapse in={expanded} unmountOnExit>
                <BatchDetails
                  batch={batch}
                  onApprove={() => approveMut.mutate(batch)}
                  onReject={() => {
                    if (window.confirm(t("preferenceAiQueueRejectConfirm")))
                      rejectMut.mutate(batch.id);
                  }}
                  approving={approveMut.isPending}
                  rejecting={rejectMut.isPending}
                />
              </Collapse>
            </Card>
          );
        })}
      </Stack>

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

function QueueItemRow({
  item,
  model,
  employeeName,
  rowBg,
}: {
  item: ProposedPipelineItem;
  model?: string;
  employeeName: string;
  rowBg: string;
}) {
  const { t } = useTranslation();
  const noteDisplayed = preferenceAiQueueDisplayNotes(item.reason, model);
  return (
    <TableRow sx={{ bgcolor: rowBg }}>
      <TableCell>{item.date}</TableCell>
      <TableCell>{employeeName}</TableCell>
      <TableCell>{t(item.recommendedStatus)}</TableCell>
      <TableCell sx={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: 320 }}>
        {noteDisplayed}
      </TableCell>
    </TableRow>
  );
}

type BatchDetailsProps = {
  batch: AiBatchPublic;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
};

function BatchDetails({ batch, onApprove, onReject, approving, rejecting }: BatchDetailsProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const intlTag = appIntlLocale(i18n.language as AppLocale);

  const employeesQ = useQuery({
    queryKey: ["preference-ai-queue-employees", batch.departmentId],
    enabled: !!batch.departmentId && batch.departmentId.length === 24,
    queryFn: async () => {
      const limit = 100;
      const all: Employee[] = [];
      let page = 1;
      while (true) {
        const { data } = await api.get<{ items: Employee[]; total: number }>(
          `/api/employees?page=${page}&limit=${limit}&departmentId=${encodeURIComponent(batch.departmentId)}`
        );
        all.push(...data.items);
        if (all.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      return all;
    },
  });

  const empById = useMemo(
    () => new Map((employeesQ.data ?? []).map((e) => [e.id, e])),
    [employeesQ.data]
  );

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const rowsByDate = useMemo(() => {
    const groups = new Map<string, ProposedPipelineItem[]>();
    for (const item of batch.proposedItems) {
      const list = groups.get(item.date) ?? [];
      list.push(item);
      groups.set(item.date, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => {
        const sorted = [...rows].sort((a, b) => {
          const aSubmitted = (a.preferenceSource ?? "none") === "employee" ? 0 : 1;
          const bSubmitted = (b.preferenceSource ?? "none") === "employee" ? 0 : 1;
          if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;
          const aName = empById.get(a.employeeId)?.fullName?.trim() ?? a.employeeId;
          const bName = empById.get(b.employeeId)?.fullName?.trim() ?? b.employeeId;
          return aName.localeCompare(bName, intlTag);
        });
        return { date, rows: sorted };
      });
  }, [batch.proposedItems, empById, intlTag]);

  const submittedRows = useMemo(
    () =>
      rowsByDate.flatMap(({ rows }) =>
        rows.filter((row) => (row.preferenceSource ?? "none") === "employee")
      ),
    [rowsByDate]
  );

  const visibleGroups = selectedDate
    ? rowsByDate.filter((group) => group.date === selectedDate)
    : rowsByDate;

  const legendSubmittedBg = alpha(
    theme.palette.primary.main,
    theme.palette.mode === "dark" ? 0.16 : 0.1
  );
  const legendAiFillBg = alpha(
    theme.palette.grey[500],
    theme.palette.mode === "dark" ? 0.12 : 0.07
  );

  return (
    <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: "divider" }}>
      {!batch.locationId && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("preferenceAiQueueMissingLocation")}
        </Alert>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          color="success"
          size="small"
          disabled={
            approving || rejecting || !batch.locationId || batch.status !== "pending_manager"
          }
          onClick={onApprove}
        >
          {t("preferenceAiQueueApprove")}
        </Button>
        <Button
          variant="outlined"
          color="warning"
          size="small"
          disabled={approving || rejecting || batch.status !== "pending_manager"}
          onClick={onReject}
        >
          {t("preferenceAiQueueReject")}
        </Button>
      </Stack>

      <Stack spacing={1} sx={{ mb: 1.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          {t("preferenceAiQueueLegendTitle")}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          flexWrap="wrap"
          useFlexGap
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: 0.75,
                bgcolor: legendSubmittedBg,
                flexShrink: 0,
                mt: 0.15,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t("preferenceAiQueueLegendSubmitted")}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: 0.75,
                bgcolor: legendAiFillBg,
                flexShrink: 0,
                mt: 0.15,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t("preferenceAiQueueLegendAiFill")}
            </Typography>
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {t("preferenceAiQueueNotesExplainer")}
        </Typography>
      </Stack>

      {employeesQ.isLoading ? (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={t("preferenceAiQueueAllDates")}
              color={selectedDate === null ? "primary" : "default"}
              variant={selectedDate === null ? "filled" : "outlined"}
              onClick={() => setSelectedDate(null)}
            />
            {rowsByDate.map(({ date, rows }) => {
              const submitted = rows.filter((row) => (row.preferenceSource ?? "none") === "employee").length;
              return (
                <Chip
                  key={date}
                  size="small"
                  label={`${utcWeekdayShort(date, intlTag)} ${date}${submitted ? ` · ${submitted}` : ""}`}
                  color={selectedDate === date ? "primary" : "default"}
                  variant={selectedDate === date ? "filled" : "outlined"}
                  onClick={() => setSelectedDate(date)}
                />
              );
            })}
          </Stack>

          {submittedRows.length > 0 && selectedDate === null && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t("preferenceAiQueueSubmittedSection")}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("reportsColWorkDate")}</TableCell>
                    <TableCell>{t("fullName")}</TableCell>
                    <TableCell>{t("notificationsStatusLabel")}</TableCell>
                    <TableCell>{t("notes")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submittedRows.map((p) => (
                    <QueueItemRow
                      key={`submitted-${batch.id}-${p.date}-${p.employeeId}`}
                      item={p}
                      model={batch.model}
                      employeeName={
                        empById.get(p.employeeId)?.fullName?.trim() || `…${p.employeeId.slice(-8)}`
                      }
                      rowBg={legendSubmittedBg}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("preferenceAiQueueAllDaysSection")}
            </Typography>
            <Box sx={{ maxHeight: "70vh", overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t("reportsColWorkDate")}</TableCell>
                    <TableCell>{t("fullName")}</TableCell>
                    <TableCell>{t("notificationsStatusLabel")}</TableCell>
                    <TableCell>{t("notes")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleGroups.map(({ date, rows }) => (
                    <Fragment key={`${batch.id}-${date}`}>
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          sx={{
                            fontWeight: 700,
                            bgcolor: "background.paper",
                            borderBottom: 1,
                            borderColor: "divider",
                          }}
                        >
                          {date} · {utcWeekdayShort(date, intlTag)} · {rows.length}
                        </TableCell>
                      </TableRow>
                      {rows.map((p) => {
                        const source = p.preferenceSource ?? "none";
                        return (
                          <QueueItemRow
                            key={`${batch.id}-${p.date}-${p.employeeId}`}
                            item={p}
                            model={batch.model}
                            employeeName={
                              empById.get(p.employeeId)?.fullName?.trim() ||
                              `…${p.employeeId.slice(-8)}`
                            }
                            rowBg={source === "employee" ? legendSubmittedBg : legendAiFillBg}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
