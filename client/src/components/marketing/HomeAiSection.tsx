import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RuleIcon from "@mui/icons-material/Rule";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { alpha, Box, Chip, Container, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { brandGradient, brandGradientSoft } from "./brandGradient";
import { LANDING_CARD_RADIUS } from "./landingTheme";

function GlassPanel({ children, sx }: { children: ReactNode; sx?: object }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: `${LANDING_CARD_RADIUS}px`,
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.88 : 0.82),
        backdropFilter: "saturate(160%) blur(12px)",
        WebkitBackdropFilter: "saturate(160%) blur(12px)",
        boxShadow: "0 12px 32px -12px rgba(15, 23, 42, 0.12)",
        p: { xs: 2, md: 2.5 },
        height: "100%",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export default function HomeAiSection() {
  const { t } = useTranslation();
  const theme = useTheme();

  const recRows = [
    { label: t("homeActivityAiRecRow1"), status: t("homeActivityAiRecStatusPending") },
    { label: t("homeActivityAiRecRow2"), status: t("homeActivityAiRecStatusReady") },
    { label: t("homeActivityAiRecRow3"), status: t("scheduleSourceAi") },
  ];

  const assistantChips = [
    t("assistantChipSchedules"),
    t("assistantChipDeptVacation"),
    t("assistantChipManagerOffice"),
  ];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        zIndex: 1,
        py: { xs: 5, md: 7 },
        background: brandGradientSoft,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 4 }}>
          <Chip
            icon={<AutoAwesomeIcon sx={{ fontSize: "16px !important" }} />}
            label={t("homeAiSectionBadge")}
            size="small"
            sx={{
              fontWeight: 700,
              background: alpha(theme.palette.primary.main, 0.12),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
            }}
          />
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, fontSize: { xs: "1.35rem", md: "1.85rem" } }}>
            {t("homeAiSectionTitle")}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
            {t("homeAiSectionSubtitle")}
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          <GlassPanel>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <AutoAwesomeIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("ai")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("homeAiRecPanelHint")}
                </Typography>
              </Box>
            </Stack>
            <Stack spacing={1}>
              {recRows.map((row) => (
                <Box
                  key={row.label}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    px: 1.25,
                    py: 1,
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                  }}
                >
                  <Typography variant="caption" fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
                    {row.label}
                  </Typography>
                  <Chip size="small" label={row.status} sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }} />
                </Box>
              ))}
            </Stack>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              <Chip size="small" icon={<RuleIcon sx={{ fontSize: 14 }} />} label={t("schedulingRules")} variant="outlined" />
              <Chip size="small" label={t("homeAiRecChipRules")} variant="outlined" />
            </Stack>
          </GlassPanel>

          <GlassPanel>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "12px",
                  background: brandGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <SmartToyOutlinedIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("assistantHeaderTitle")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("assistantHeaderSubtitle")}
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.secondary.main, 0.08),
                mb: 1.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t("assistantIntroTitle")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                {t("homeActivityAssistantReply")}
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.75 }}>
              {t("assistantExamplesLabel")}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {assistantChips.map((chip) => (
                <Chip key={chip} size="small" label={chip} sx={{ maxWidth: "100%", height: "auto", py: 0.5, "& .MuiChip-label": { whiteSpace: "normal" } }} />
              ))}
            </Stack>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, fontSize: "0.85rem" }}>
                {t("assistantInputPlaceholder")}
              </Typography>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: brandGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                <SendRoundedIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>
          </GlassPanel>
        </Box>
      </Container>
    </Box>
  );
}
