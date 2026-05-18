import { Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Navigate } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import HomeActivityCarousel from "../components/marketing/HomeActivityCarousel";
import HomeAiSection from "../components/marketing/HomeAiSection";
import HomeAvatarMarquee from "../components/marketing/HomeAvatarMarquee";
import HomeCtaBand from "../components/marketing/HomeCtaBand";
import HomeFeaturesSection from "../components/marketing/HomeFeaturesSection";
import HomeHeroSection from "../components/marketing/HomeHeroSection";
import HomeWorkflowSection from "../components/marketing/HomeWorkflowSection";
import {
  landingEmeraldBlobSx,
  landingGradientBlobsSx,
  landingPageRootSx,
  landingVioletBlobSx,
} from "../components/marketing/landingTheme";
import { useAuth } from "../store/authContext";

export default function HomePage() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Box sx={landingPageRootSx}>
      <Box sx={landingGradientBlobsSx} />
      <Box sx={landingVioletBlobSx} />
      <Box sx={landingEmeraldBlobSx} />

      <Box sx={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <PublicHeader variant="marketing" />

        <HomeHeroSection />
        <HomeAvatarMarquee />
        <HomeActivityCarousel />
        <HomeAiSection />
        <HomeFeaturesSection />
        <HomeWorkflowSection />
        <HomeCtaBand />

        <Container
          maxWidth="lg"
          sx={{
            px: { xs: 2, sm: 3 },
            pb: `max(32px, env(safe-area-inset-bottom, 0px))`,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ py: 2 }}>
            <Button component={RouterLink} to="/about" variant="outlined" color="inherit" size="small">
              {t("publicNavAbout")}
            </Button>
            <Button component={RouterLink} to="/pricing" variant="outlined" color="inherit" size="small">
              {t("publicNavPricing")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", pb: 2 }}>
            {t("homeLinksAboutPricing")}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
