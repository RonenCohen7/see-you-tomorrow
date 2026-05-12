import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import type { Employee } from "../types/models";
import { useAuth, useRole } from "../store/authContext";
import { preferenceAiQueueDisplayNotes } from "../utils/preferenceAiQueueDisplayNotes";

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
  const { user } = useAuth();

  const [deptId, setDeptId] = useState("");
  useEffect(() => {
    if (role === "manager" && user?.departmentId && !deptId) setDeptId(user.departmentId);
  }, [role, user?.departmentId, deptId]);

  const deptsQ = useQuery({
    queryKey: ["departments-ai-queue"],
    queryFn: async () => (await api.get<{ items: { id: string; name: string }[] }>("/api/departments")).data.items,
    enabled: role === "admin",
  });

  const batchQ = useQuery({
    queryKey: ["ai-batches-pending-pipeline", deptId],
    queryFn: async () =>
      (
        await api.get<{ items: AiBatchPublic[] }>("/api/schedules/ai-batches/pending-pipeline", {
          params: { departmentId: deptId },
        })
      ).data.items,
    enabled: !!deptId && deptId.length === 24,
  });

  const employeesQ = useQuery({
    queryKey: ["preference-ai-queue-employees", deptId],
    enabled: !!deptId && deptId.length === 24,
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

  const empById = useMemo(() => new Map((employeesQ.data ?? []).map((e) => [e.id, e])), [employeesQ.data]);

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

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
      await qc.invalidateQueries({ queryKey: ["ai-batches-pending-pipeline"] });
      void qc.invalidateQueries({ queryKey: ["schedules-all"] });
      void qc.invalidateQueries({ queryKey: ["schedules-recent"] });
    },
    onError: () => setToast({ ok: false, msg: t("error") }),
  });

  const rejectMut = useMutation({
    mutationFn: async (batchId: string) => {
      await api.post(`/api/schedules/ai-batches/${batchId}/reject-pipeline`);
    },
    onSuccess: async () => {
      setToast({ ok: true, msg: t("preferenceAiQueueRejected") });
      await qc.invalidateQueries({ queryKey: ["ai-batches-pending-pipeline"] });
    },
    onError: () => setToast({ ok: false, msg: t("error") }),
  });

  const showDeptPick = role === "admin";

  const headerNote = useMemo(() => {
    if (role === "manager") return t("preferenceAiQueueManagerNote");
    return t("preferenceAiQueueAdminNote");
  }, [role, t]);

  const legendSubmittedBg = alpha(
    theme.palette.primary.main,
    theme.palette.mode === "dark" ? 0.16 : 0.1
  );
  const legendAiFillBg = alpha(theme.palette.grey[500], theme.palette.mode === "dark" ? 0.12 : 0.07);

  return (
    <Box sx={{ maxWidth: 960 }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("preferenceAiQueueTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {headerNote}
      </Typography>

      {showDeptPick && (
        <FormControl sx={{ mb: 2, minWidth: 260 }} size="small">
          <InputLabel id="dept-pick">{t("department")}</InputLabel>
          <Select
            labelId="dept-pick"
            label={t("department")}
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
          >
            {(deptsQ.data ?? []).map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {!deptId && <Alert severity="info">{t("preferenceAiQueuePickDept")}</Alert>}

      {deptId && batchQ.isLoading && (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={36} />
        </Stack>
      )}

      {deptId && batchQ.data?.length === 0 && (
        <Alert severity="success">{t("preferenceAiQueueEmpty")}</Alert>
      )}

      {batchQ.data?.map((batch) => (
        <Card key={batch.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {batch.dateRange.from} — {batch.dateRange.to}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Batch …{batch.id.slice(-8)} · {batch.proposedItems.length} {t("preferenceAiQueueRows")}
                </Typography>
                {!batch.locationId ? (
                  <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                    {t("preferenceAiQueueMissingLocation")}
                  </Alert>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  disabled={
                    approveMut.isPending ||
                    rejectMut.isPending ||
                    !batch.locationId ||
                    batch.status !== "pending_manager"
                  }
                  onClick={() => approveMut.mutate(batch)}
                >
                  {t("preferenceAiQueueApprove")}
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  size="small"
                  disabled={approveMut.isPending || rejectMut.isPending || batch.status !== "pending_manager"}
                  onClick={() => {
                    if (window.confirm(t("preferenceAiQueueRejectConfirm"))) rejectMut.mutate(batch.id);
                  }}
                >
                  {t("preferenceAiQueueReject")}
                </Button>
              </Stack>
            </Stack>
            <Stack spacing={1} sx={{ mt: 2 }}>
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
                  <Box sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: legendSubmittedBg, flexShrink: 0, mt: 0.15 }} />
                  <Typography variant="caption" color="text.secondary">
                    {t("preferenceAiQueueLegendSubmitted")}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: legendAiFillBg, flexShrink: 0, mt: 0.15 }} />
                  <Typography variant="caption" color="text.secondary">
                    {t("preferenceAiQueueLegendAiFill")}
                  </Typography>
                </Stack>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {t("preferenceAiQueueNotesExplainer")}
              </Typography>
            </Stack>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t("reportsColWorkDate")}</TableCell>
                  <TableCell>{t("fullName")}</TableCell>
                  <TableCell>{t("notificationsStatusLabel")}</TableCell>
                  <TableCell>{t("notes")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batch.proposedItems.slice(0, 12).map((p) => {
                  const source = p.preferenceSource ?? "none";
                  const rowBg = source === "employee" ? legendSubmittedBg : legendAiFillBg;
                  const noteDisplayed = preferenceAiQueueDisplayNotes(p.reason, batch.model);
                  return (
                    <TableRow
                      key={`${batch.id}-${p.date}-${p.employeeId}`}
                      sx={{ bgcolor: rowBg }}
                    >
                      <TableCell>{p.date}</TableCell>
                      <TableCell>
                        {empById.get(p.employeeId)?.fullName?.trim() ||
                          `…${p.employeeId.slice(-8)}`}
                      </TableCell>
                      <TableCell>{t(p.recommendedStatus)}</TableCell>
                      <TableCell sx={{ whiteSpace: "normal", wordBreak: "break-word", maxWidth: 320 }}>
                        {noteDisplayed}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {batch.proposedItems.length > 12 ? (
              <Typography variant="caption" color="text.secondary">
                {t("preferenceAiQueueTruncate", { shown: 12, total: batch.proposedItems.length })}
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      ))}

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
