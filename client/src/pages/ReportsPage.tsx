import AssessmentIcon from "@mui/icons-material/Assessment";
import {
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Alert,
  Chip,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useAuth } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";
import { todayIsoLocal } from "../utils/date";
import type { StatusKey } from "../theme/theme";

const REPORT_STATUSES: StatusKey[] = ["office", "home", "vacation", "sick"];

type DailyPreview = {
  from: string;
  to: string;
  status: string;
  title: string;
  rows: { fullName: string; workDate: string }[];
  filterEmployeeId?: string;
  filterEmployeeName?: string;
};

type ParkingPreview = {
  from: string;
  to: string;
  title: string;
  rows: {
    spotLabel: string;
    locationName: string;
    ownerName: string;
    assigneeName: string;
    workDate: string;
    hoursText: string;
  }[];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dailyStatusQueryString(from: string, to: string, status: string, employeeId?: string): string {
  const p = new URLSearchParams({ from, to, status });
  if (employeeId) p.set("employeeId", employeeId);
  return p.toString();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID = /^[a-f\d]{24}$/i;

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFrom, setStatusFrom] = useState(todayIsoLocal());
  const [statusTo, setStatusTo] = useState(todayIsoLocal());
  const [statusTab, setStatusTab] = useState(0);
  const status = REPORT_STATUSES[statusTab] ?? "office";
  const [parkingFrom, setParkingFrom] = useState(todayIsoLocal());
  const [parkingTo, setParkingTo] = useState(todayIsoLocal());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const filterEmployeeId = useMemo(() => {
    const raw = searchParams.get("employeeId")?.trim() ?? "";
    return OBJECT_ID.test(raw) ? raw : undefined;
  }, [searchParams]);

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const st = searchParams.get("status");
    if (from && ISO_DATE.test(from)) setStatusFrom(from);
    if (to && ISO_DATE.test(to)) setStatusTo(to);
    if (st && (REPORT_STATUSES as readonly string[]).includes(st)) {
      setStatusTab(REPORT_STATUSES.indexOf(st as (typeof REPORT_STATUSES)[number]));
    }
  }, [searchParams]);

  const dailyQ = useQuery({
    queryKey: ["reports-daily-preview", statusFrom, statusTo, status, filterEmployeeId],
    queryFn: async () =>
      (
        await api.get<DailyPreview>(
          `/api/reports/daily-status/preview?${dailyStatusQueryString(statusFrom, statusTo, status, filterEmployeeId)}`
        )
      ).data,
    enabled: statusFrom <= statusTo,
  });

  const parkingQ = useQuery({
    queryKey: ["reports-parking-preview", parkingFrom, parkingTo],
    queryFn: async () =>
      (await api.get<ParkingPreview>(`/api/reports/parking-assignments/preview?from=${parkingFrom}&to=${parkingTo}`))
        .data,
  });

  const dailyRows = dailyQ.data?.rows ?? [];
  const parkingRows = parkingQ.data?.rows ?? [];

  const pdfDailyMut = useMutation({
    mutationFn: async () => {
      if (statusFrom > statusTo) {
        setToast({ msg: t("reportsInvalidDateRange"), ok: false });
        return;
      }
      const res = await api.get<Blob>(
        `/api/reports/daily-status/pdf?${dailyStatusQueryString(statusFrom, statusTo, status, filterEmployeeId)}`,
        { responseType: "blob" }
      );
      const title = dailyQ.data?.title ?? t(status);
      const fn =
        statusFrom === statusTo ? `${title}-${statusFrom}.pdf` : `${title}-${statusFrom}-${statusTo}.pdf`;
      downloadBlob(res.data, fn);
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const emailDailyMut = useMutation({
    mutationFn: async () => {
      if (statusFrom > statusTo) {
        const err = new Error("RANGE");
        (err as Error & { code?: string }).code = "RANGE";
        throw err;
      }
      return api.post("/api/reports/daily-status/email", {
        from: statusFrom,
        to: statusTo,
        status,
        recipientEmail: user?.email,
        ...(filterEmployeeId ? { employeeId: filterEmployeeId } : {}),
      });
    },
    onSuccess: () => setToast({ msg: t("reportsEmailSent"), ok: true }),
    onError: (e) => {
      if ((e as Error & { code?: string }).code === "RANGE") {
        setToast({ msg: t("reportsInvalidDateRange"), ok: false });
        return;
      }
      setToast({ msg: apiErrorMessage(e, t("error")), ok: false });
    },
  });

  const pdfParkingMut = useMutation({
    mutationFn: async () => {
      const res = await api.get<Blob>(`/api/reports/parking-assignments/pdf?from=${parkingFrom}&to=${parkingTo}`, {
        responseType: "blob",
      });
      downloadBlob(res.data, `parking-${parkingFrom}-${parkingTo}.pdf`);
    },
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const emailParkingMut = useMutation({
    mutationFn: async () =>
      api.post("/api/reports/parking-assignments/email", {
        from: parkingFrom,
        to: parkingTo,
        recipientEmail: user?.email,
      }),
    onSuccess: () => setToast({ msg: t("reportsEmailSent"), ok: true }),
    onError: (e) => setToast({ msg: apiErrorMessage(e, t("error")), ok: false }),
  });

  const dailyTitle = useMemo(() => dailyQ.data?.title ?? t(status), [dailyQ.data?.title, status, t]);

  return (
    <Box sx={{ width: "100%", maxWidth: 960, mx: "auto", px: { xs: 1, sm: 2 }, py: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <AssessmentIcon color="primary" fontSize="large" />
        <Typography variant="h4" sx={{ fontSize: { xs: "1.35rem", sm: "2rem" } }}>
          {t("reports")}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("reportsPageIntro")}
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("reportsDailySection")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              type="date"
              label={t("reportsDailyFrom")}
              InputLabelProps={{ shrink: true }}
              value={statusFrom}
              onChange={(e) => setStatusFrom(e.target.value)}
            />
            <TextField
              type="date"
              label={t("reportsDailyTo")}
              InputLabelProps={{ shrink: true }}
              value={statusTo}
              onChange={(e) => setStatusTo(e.target.value)}
            />
          </Stack>
          {statusFrom > statusTo ? (
            <Typography variant="body2" color="error" sx={{ mb: 1 }}>
              {t("reportsInvalidDateRange")}
            </Typography>
          ) : null}
          {dailyQ.isError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {apiErrorMessage(dailyQ.error, t("reportsLoadError"))}
            </Alert>
          ) : null}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, maxWidth: 640 }}>
            {t("reportsDateFieldsHint")}
          </Typography>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Tabs value={statusTab} onChange={(_, v) => setStatusTab(v)} variant="scrollable" scrollButtons="auto">
              {REPORT_STATUSES.map((s, i) => (
                <Tab key={s} label={t(s)} value={i} />
              ))}
            </Tabs>
          </Stack>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
            {dailyTitle}
          </Typography>
          {statusFrom <= statusTo ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, lineHeight: 1.5 }}>
              {t("reportsActiveQuery", { status: t(status), from: statusFrom, to: statusTo })}
            </Typography>
          ) : null}
          {filterEmployeeId ? (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={t("reportsFilterEmployeeChip", {
                name: dailyQ.data?.filterEmployeeName ?? "…",
              })}
              onDelete={() => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev);
                  p.delete("employeeId");
                  return p;
                });
              }}
              sx={{ alignSelf: "flex-start", mb: 1 }}
            />
          ) : null}
          <Button
            component={RouterLink}
            to="/schedules?forReport=1"
            size="small"
            variant="text"
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            {t("reportsOpenSchedulesForContext")}
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("reportsColFullName")}</TableCell>
                <TableCell>{t("reportsColWorkDate")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Stack spacing={0.75}>
                      <Typography color="text.secondary">{t("reportsEmpty")}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {t("reportsEmptyHintDaily")}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : (
                dailyRows.map((r, i) => (
                  <TableRow key={`${r.fullName}-${r.workDate}-${i}`}>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell dir="ltr" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.workDate}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => pdfDailyMut.mutate()}
              disabled={pdfDailyMut.isPending || statusFrom > statusTo}
            >
              {t("reportsDownloadPdf")}
            </Button>
            <Button
              variant="contained"
              onClick={() => emailDailyMut.mutate()}
              disabled={emailDailyMut.isPending || statusFrom > statusTo}
            >
              {t("reportsSendEmail")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t("reportsEmailHint")}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("reportsParkingSection")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              type="date"
              label={t("reportsParkingFrom")}
              InputLabelProps={{ shrink: true }}
              value={parkingFrom}
              onChange={(e) => setParkingFrom(e.target.value)}
            />
            <TextField
              type="date"
              label={t("reportsParkingTo")}
              InputLabelProps={{ shrink: true }}
              value={parkingTo}
              onChange={(e) => setParkingTo(e.target.value)}
            />
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t("reportsColSpot")}</TableCell>
                <TableCell>{t("reportsColLocation")}</TableCell>
                <TableCell>{t("reportsColOwner")}</TableCell>
                <TableCell>{t("reportsColAssignee")}</TableCell>
                <TableCell>{t("reportsColWorkDate")}</TableCell>
                <TableCell>{t("reportsColHours")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parkingRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">{t("reportsEmpty")}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                parkingRows.map((r) => (
                  <TableRow key={`${r.spotLabel}-${r.workDate}-${r.assigneeName}`}>
                    <TableCell>{r.spotLabel}</TableCell>
                    <TableCell>{r.locationName || "—"}</TableCell>
                    <TableCell>{r.ownerName}</TableCell>
                    <TableCell>{r.assigneeName}</TableCell>
                    <TableCell dir="ltr">{r.workDate}</TableCell>
                    <TableCell>{r.hoursText}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => pdfParkingMut.mutate()} disabled={pdfParkingMut.isPending}>
              {t("reportsDownloadPdf")}
            </Button>
            <Button variant="contained" onClick={() => emailParkingMut.mutate()} disabled={emailParkingMut.isPending}>
              {t("reportsSendEmail")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t("reportsEmailHint")}
          </Typography>
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
