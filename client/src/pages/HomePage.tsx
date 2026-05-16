import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import HubIcon from "@mui/icons-material/Hub";
import { alpha, Box, Button, Card, CardContent, Container, Stack, Typography, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Navigate } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import { MutedBackdropVideo } from "../components/MutedBackdropVideo";
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
    <Box
      sx={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        isolation: "isolate",
        bgcolor: "background.default",
      }}
    >
      <MutedBackdropVideo />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <PublicHeader />

        <Box sx={{ py: { xs: 6, md: 10 } }}>
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
            <Stack spacing={3} alignItems="center" textAlign="center">
              <Typography variant="overline" color="primary">
                See You Tomorrow
              </Typography>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 700,
                  maxWidth: 720,
                  fontSize: { xs: "1.65rem", sm: "2.5rem", md: "3rem" },
                  px: { xs: 0.5, sm: 0 },
                }}
              >
                {t("homeHeroTitle")}
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ maxWidth: 560, fontWeight: 400, fontSize: { xs: "1rem", sm: "1.25rem" } }}
              >
                {t("homeHeroSubtitle")}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                <Button component={RouterLink} to="/about" variant="text" size="medium" sx={{ opacity: 0.95 }}>
                  {t("publicNavAbout")}
                </Button>
                <Typography component="span" variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                  ·
                </Typography>
                <Button component={RouterLink} to="/pricing" variant="text" size="medium" sx={{ opacity: 0.95 }}>
                  {t("publicNavPricing")}
                </Button>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                <Button component={RouterLink} to="/login" variant="contained" size="large">
                  {t("loginUserOrAdmin")}
                </Button>
                <Button component={RouterLink} to="/register" variant="outlined" size="large">
                  {t("register")}
                </Button>
              </Stack>
              <Button component={RouterLink} to="/login" color="primary" endIcon={<CalendarMonthIcon />}>
                {t("homeCalendarTeaser")}
              </Button>
            </Stack>
          </Container>
        </Box>

        <Container
          maxWidth="lg"
          sx={{ py: { xs: 4, md: 6 }, flex: 1, px: { xs: 2, sm: 3 }, pb: `max(32px, env(safe-area-inset-bottom, 0px))` }}
        >
          <Typography variant="h5" textAlign="center" gutterBottom sx={{ mb: 4 }}>
            {t("homeFeaturesTitle")}
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            useFlexGap
            sx={{ alignItems: "stretch", justifyContent: "center" }}
          >
            <Box sx={{ flex: 1, minWidth: 0, maxWidth: { md: 400 } }}>
              <Card
                variant="outlined"
                sx={(th) => ({
                  height: "100%",
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.82 : 0.9),
                  backdropFilter: "saturate(140%) blur(10px)",
                  WebkitBackdropFilter: "saturate(140%) blur(10px)",
                })}
              >
                <CardContent>
                  <CalendarMonthIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {t("calendar")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("homeFeatureCalendar")}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, maxWidth: { md: 400 } }}>
              <Card
                variant="outlined"
                sx={(th) => ({
                  height: "100%",
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.82 : 0.9),
                  backdropFilter: "saturate(140%) blur(10px)",
                  WebkitBackdropFilter: "saturate(140%) blur(10px)",
                })}
              >
                <CardContent>
                  <GroupsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {t("homeFeatureTeamTitle")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("homeFeatureTeam")}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, maxWidth: { md: 400 } }}>
              <Card
                variant="outlined"
                sx={(th) => ({
                  height: "100%",
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.82 : 0.9),
                  backdropFilter: "saturate(140%) blur(10px)",
                  WebkitBackdropFilter: "saturate(140%) blur(10px)",
                })}
              >
                <CardContent>
                  <HubIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {t("homeFeatureHybridTitle")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("homeFeatureHybrid")}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mt: 3 }}>
            <Button component={RouterLink} to="/about" variant="outlined" color="inherit" size="small">
              {t("publicNavAbout")}
            </Button>
            <Button component={RouterLink} to="/pricing" variant="outlined" color="inherit" size="small">
              {t("publicNavPricing")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.5 }}>
            {t("homeLinksAboutPricing")}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
