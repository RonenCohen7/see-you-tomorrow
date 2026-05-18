import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import HubIcon from "@mui/icons-material/Hub";
import { alpha, Box, Card, CardContent, Container, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { featureCardShadow, LANDING_CARD_RADIUS } from "./landingTheme";

type FeatureItem = {
  icon: ReactNode;
  titleKey: string;
  bodyKey: string;
  accent: string;
};

function FeatureCard({ icon, title, body, accent }: { icon: ReactNode; title: string; body: string; accent: string }) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: `${LANDING_CARD_RADIUS}px`,
        border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
        boxShadow: featureCardShadow,
        bgcolor: "background.paper",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "@media (prefers-reduced-motion: no-preference)": {
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 12px 32px -8px rgba(15, 23, 42, 0.12)",
          },
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
            bgcolor: alpha(accent, theme.palette.mode === "dark" ? 0.22 : 0.12),
            color: accent,
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {body}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function HomeFeaturesSection() {
  const { t } = useTranslation();
  const theme = useTheme();

  const features: FeatureItem[] = [
    {
      icon: <CalendarMonthIcon />,
      titleKey: "calendar",
      bodyKey: "homeFeatureCalendar",
      accent: theme.palette.primary.main,
    },
    {
      icon: <GroupsIcon />,
      titleKey: "homeFeatureTeamTitle",
      bodyKey: "homeFeatureTeam",
      accent: theme.palette.secondary.main,
    },
    {
      icon: <HubIcon />,
      titleKey: "homeFeatureHybridTitle",
      bodyKey: "homeFeatureHybrid",
      accent: "#a78bfa",
    },
    {
      icon: <AutoAwesomeIcon />,
      titleKey: "homeFeatureAiTitle",
      bodyKey: "homeFeatureAi",
      accent: "#ec4899",
    },
  ];

  return (
    <Box component="section" sx={{ py: { xs: 6, md: 10 }, position: "relative", zIndex: 1 }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h4"
          component="h2"
          textAlign="center"
          sx={{ fontWeight: 800, mb: { xs: 3, md: 5 }, fontSize: { xs: "1.5rem", md: "2rem" } }}
        >
          {t("homeFeaturesTitle")}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          {features.map((f) => (
            <FeatureCard
              key={f.bodyKey}
              icon={f.icon}
              title={t(f.titleKey)}
              body={t(f.bodyKey)}
              accent={f.accent}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
}
