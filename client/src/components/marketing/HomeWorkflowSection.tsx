import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import { alpha, Box, Chip, Container, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { brandGradientSoft } from "./brandGradient";

function FlowNode({
  icon,
  label,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  accent: string;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2.5,
        bgcolor: "background.paper",
        border: `1px solid ${alpha(accent, 0.35)}`,
        boxShadow: `0 8px 24px -8px ${alpha(accent, 0.35)}`,
        minWidth: { xs: "100%", sm: 200 },
        maxWidth: 280,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(accent, theme.palette.mode === "dark" ? 0.25 : 0.12),
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {label}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {sub}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function FlowArrow() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 0.5, color: "text.secondary" }}>
      <ArrowDownwardIcon fontSize="small" />
    </Box>
  );
}

export default function HomeWorkflowSection() {
  const { t } = useTranslation();
  const theme = useTheme();

  const steps = [
    {
      icon: <PersonIcon fontSize="small" />,
      label: t("homeFlowStep1Title"),
      sub: t("homeFlowStep1Body"),
      accent: theme.palette.primary.main,
    },
    {
      icon: <CalendarMonthIcon fontSize="small" />,
      label: t("homeFlowStep2Title"),
      sub: t("homeFlowStep2Body"),
      accent: theme.palette.secondary.main,
    },
    {
      icon: <NotificationsIcon fontSize="small" />,
      label: t("homeFlowStep3Title"),
      sub: t("homeFlowStep3Body"),
      accent: "#22c55e",
    },
    {
      icon: <AutoAwesomeIcon fontSize="small" />,
      label: t("homeFlowStep4Title"),
      sub: t("homeFlowStep4Body"),
      accent: "#ec4899",
    },
  ];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        zIndex: 1,
        py: { xs: 6, md: 9 },
        background: brandGradientSoft,
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h4"
          component="h2"
          textAlign="center"
          sx={{ fontWeight: 800, mb: 1, fontSize: { xs: "1.35rem", md: "1.85rem" } }}
        >
          {t("homeFlowTitle")}
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4, maxWidth: 520, mx: "auto" }}>
          {t("homeFlowSubtitle")}
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 24,
              bottom: 24,
              left: "50%",
              width: 2,
              transform: "translateX(-50%)",
              background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.35)} 100%)`,
              display: { xs: "none", sm: "block" },
            },
          }}
        >
          {steps.map((step, i) => (
            <Box key={step.label} sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <FlowNode icon={step.icon} label={step.label} sub={step.sub} accent={step.accent} />
              {i < steps.length - 1 && <FlowArrow />}
            </Box>
          ))}
        </Box>

        <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
          <Chip
            label={t("homeFlowOutcome")}
            sx={{
              fontWeight: 700,
              px: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          />
        </Stack>
      </Container>
    </Box>
  );
}
