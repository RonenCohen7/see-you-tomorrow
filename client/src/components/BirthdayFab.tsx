import CakeIcon from "@mui/icons-material/Cake";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  Zoom,
  alpha,
  useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { useAuth } from "../store/authContext";
import { todayIsoLocal } from "../utils/date";

const LS_PREFIX = "syt_birthday_fab_dismissed_";

type BirthdayHit = { employeeId: string; fullName: string; date: string };

type Props = { socket: Socket | null };

function dismissedKey(iso: string): string {
  return `${LS_PREFIX}${iso}`;
}

export function BirthdayFab({ socket }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayIsoLocal();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const [rev, setRev] = useState(0);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employees-birthdays-range", today, today],
    queryFn: async () =>
      (await api.get<{ items: BirthdayHit[] }>(`/api/employees/birthdays-range?from=${today}&to=${today}`)).data
        .items,
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!socket) return;
    const bump = () => {
      void qc.invalidateQueries({ queryKey: ["employees-birthdays-range"] });
    };
    socket.on("schedule:updated", bump);
    socket.on("dashboard:refresh", bump);
    return () => {
      socket.off("schedule:updated", bump);
      socket.off("dashboard:refresh", bump);
    };
  }, [socket, qc]);

  const dismissed = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(dismissedKey(today)) === "1";
  }, [today, rev]);

  const namesText = useMemo(() => items.map((i) => i.fullName).join(", "), [items]);

  const blessing = useMemo(() => {
    if (items.length === 0) return "";
    if (items.length === 1) return t("birthdayBlessingOne", { name: items[0].fullName });
    return t("birthdayBlessingMany", { names: namesText });
  }, [items, namesText, t]);

  const copyBlessing = useCallback(async () => {
    if (!blessing) return;
    try {
      await navigator.clipboard.writeText(blessing);
      setCopyToast(true);
    } catch {
      /* ignore */
    }
  }, [blessing]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(dismissedKey(today), "1");
    } catch {
      /* ignore */
    }
    setDialogOpen(false);
    setRev((r) => r + 1);
  }, [today]);

  if (!user || isLoading || items.length === 0 || dismissed) return null;

  const isRtl = theme.direction === "rtl";

  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytBalloonFloat": {
            "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
            "50%": { transform: "translateY(-8px) rotate(2deg)" },
          },
        }}
      />
      <Zoom in>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Tooltip title={t("birthdayFabTooltip")} placement={isRtl ? "left" : "right"} arrow>
            <Box
              component="button"
              type="button"
              onClick={() => setDialogOpen(true)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 1.1,
                border: `1px solid ${alpha("#e91e63", 0.35)}`,
                cursor: "pointer",
                borderRadius: 999,
                color: "#5c1a4a",
                position: "relative",
                overflow: "hidden",
                background: `linear-gradient(135deg, #ffe4f3 0%, #ffd6e8 35%, #ffc8ee 70%, #fff5fb 100%)`,
                boxShadow: `0 12px 32px ${alpha("#c2185b", 0.28)}, inset 0 1px 0 ${alpha("#fff", 0.85)}`,
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
                animation: "sytBalloonFloat 3s ease-in-out infinite",
                "&:hover": {
                  transform: "translateY(-3px) scale(1.02)",
                  boxShadow: `0 16px 40px ${alpha("#c2185b", 0.35)}`,
                },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `radial-gradient(circle at 20% 30%, ${alpha("#fff", 0.5)} 0%, transparent 45%),
                    radial-gradient(circle at 80% 20%, ${alpha("#ff80ab", 0.2)} 0%, transparent 40%)`,
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: 4,
                  right: 10,
                  width: 10,
                  height: 12,
                  borderRadius: "50% 50% 45% 45%",
                  bgcolor: alpha("#e91e63", 0.35),
                  animation: "sytBalloonFloat 2.2s ease-in-out infinite 0.2s",
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  bottom: 2,
                  left: 14,
                  width: 8,
                  height: 10,
                  borderRadius: "50% 50% 45% 45%",
                  bgcolor: alpha("#9c27b0", 0.3),
                  animation: "sytBalloonFloat 2.6s ease-in-out infinite 0.5s",
                }}
              />
              <CakeIcon sx={{ fontSize: 22, color: "#ad1457", position: "relative", zIndex: 1 }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  maxWidth: 200,
                  lineHeight: 1.25,
                  textAlign: "start",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {items.length === 1 ? t("birthdayFabLabelOne") : t("birthdayFabLabelMany", { count: items.length })}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Zoom>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ pr: 5, pt: 2.5, pb: 1 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                <Stack spacing={0.5}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: "#ad1457" }}>
                    {t("birthdayDialogTitle")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("birthdayDialogSubtitle")}
                  </Typography>
                </Stack>
                <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ mt: -0.5 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: 1, position: "relative", overflow: "hidden" }}>
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.5,
                  pointerEvents: "none",
                  background: `repeating-linear-gradient(90deg, transparent, transparent 18px, ${alpha(
                    "#e91e63",
                    0.06
                  )} 18px, ${alpha("#e91e63", 0.06)} 20px)`,
                }}
              />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Box
                  key={i}
                  aria-hidden
                  sx={{
                    position: "absolute",
                    width: 6,
                    height: 10,
                    borderRadius: "50% 50% 45% 45%",
                    left: `${12 + i * 14}%`,
                    top: 8,
                    bgcolor: ["#f48fb1", "#ce93d8", "#90caf9", "#ffab91", "#a5d6a7", "#fff59d"][i % 6],
                    animation: `sytBalloonFloat ${2.4 + i * 0.15}s ease-in-out infinite`,
                    animationDelay: `${i * 0.12}s`,
                    opacity: 0.85,
                  }}
                />
              ))}
              <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.secondary.main, 0.08),
                    border: `1px dashed ${alpha("#e91e63", 0.45)}`,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    {t("birthdayNamesHeading")}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                    {items.map((p) => (
                      <Box
                        key={p.employeeId}
                        sx={{
                          px: 1.25,
                          py: 0.5,
                          borderRadius: 99,
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          bgcolor: alpha("#e91e63", 0.12),
                          color: "#880e4f",
                        }}
                      >
                        {p.fullName}
                      </Box>
                    ))}
                  </Stack>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    lineHeight: 1.7,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.paper, 0.9),
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {blessing}
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: "wrap", gap: 1 }}>
              <Button startIcon={<ContentCopyIcon />} variant="outlined" color="secondary" onClick={() => void copyBlessing()}>
                {t("birthdayCopyWishes")}
              </Button>
              <Button variant="contained" onClick={dismiss} sx={{ bgcolor: "#c2185b", "&:hover": { bgcolor: "#ad1457" } }}>
                {t("birthdayFabDismiss")}
              </Button>
            </DialogActions>
          </Dialog>
      <Snackbar open={copyToast} autoHideDuration={2500} onClose={() => setCopyToast(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" onClose={() => setCopyToast(false)} sx={{ width: "100%" }}>
          {t("birthdayCopied")}
        </Alert>
      </Snackbar>
    </>
  );
}
