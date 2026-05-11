import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Box, GlobalStyles, Tooltip, Typography, Zoom } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAiSmartAlerts } from "../hooks/useAiSmartAlerts";
import { useRole } from "../store/authContext";
import { AI_ALERTS_SIGNATURE_SEEN_KEY } from "../utils/aiSmartAlerts";

type Props = { socket: Socket | null };

export function AiInsightFab({ socket }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const role = useRole();
  const qc = useQueryClient();

  const enabled = role !== "employee";
  const { alerts, signature, loading } = useAiSmartAlerts(enabled);

  useEffect(() => {
    if (!socket) return;
    const bump = () => {
      void qc.invalidateQueries({ queryKey: ["employees-all-for-ai"] });
      void qc.invalidateQueries({ queryKey: ["schedules-recent"] });
      void qc.invalidateQueries({ queryKey: ["schedules-forward-parking"] });
      void qc.invalidateQueries({ queryKey: ["parking-spots"] });
      void qc.invalidateQueries({ queryKey: ["parking-reservations"] });
    };
    socket.on("schedule:updated", bump);
    socket.on("dashboard:refresh", bump);
    return () => {
      socket.off("schedule:updated", bump);
      socket.off("dashboard:refresh", bump);
    };
  }, [socket, qc]);

  const seen =
    typeof window !== "undefined"
      ? window.localStorage.getItem(AI_ALERTS_SIGNATURE_SEEN_KEY) ?? ""
      : "";
  const hasUnread = alerts.length > 0 && signature !== seen;

  if (!enabled || location.pathname.startsWith("/ai")) return null;
  if (loading || !hasUnread) return null;

  const isRtl = theme.direction === "rtl";

  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytAiFabPulse": {
            "0%, 100%": { boxShadow: `0 0 0 0 ${alpha(theme.palette.secondary.main, 0.45)}` },
            "50%": { boxShadow: `0 0 0 12px ${alpha(theme.palette.secondary.main, 0)}` },
          },
          "@keyframes sytAiFabFloat": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-6px)" },
          },
        }}
      />
      <Zoom in>
        <Box>
          <Tooltip title={t("aiFabTooltip")} placement={isRtl ? "left" : "right"} arrow>
            <Box
              component="button"
              type="button"
              onClick={() => navigate("/ai")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 1.1,
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                color: "#fff",
                background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.primary.main} 100%)`,
                boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.28)}`,
                animation: "sytAiFabFloat 3.2s ease-in-out infinite, sytAiFabPulse 2.2s ease-out infinite",
                transition: "transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease",
                "&:hover": {
                  transform: "translateY(-4px) scale(1.03)",
                  filter: "brightness(1.06)",
                  boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, 0.35)}`,
                },
                "&:active": { transform: "scale(0.97)" },
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 22 }} />
              <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.3, maxWidth: 140, lineHeight: 1.2 }}>
                {t("aiFabLabel")}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Zoom>
    </>
  );
}
