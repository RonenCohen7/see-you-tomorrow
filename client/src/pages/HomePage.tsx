import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import HubIcon from "@mui/icons-material/Hub";
import { Box, Button, Card, CardContent, Container, Stack, Typography, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Navigate } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
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
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <PublicHeader />

      <Box
        sx={{
          background: (theme) =>
            theme.palette.mode === "dark"
              ? "linear-gradient(180deg, rgba(21,101,192,0.15) 0%, transparent 45%)"
              : "linear-gradient(180deg, rgba(21,101,192,0.08) 0%, transparent 45%)",
          py: { xs: 6, md: 10 },
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Typography variant="overline" color="primary">
              See You Tomorrow
            </Typography>
            <Typography
              variant="h3"
              component="h1"
              sx={{ fontWeight: 700, maxWidth: 720, fontSize: { xs: "1.65rem", sm: "2.5rem", md: "3rem" }, px: { xs: 0.5, sm: 0 } }}
            >
              {t("homeHeroTitle")}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 560, fontWeight: 400, fontSize: { xs: "1rem", sm: "1.25rem" } }}>
              {t("homeHeroSubtitle")}
            </Typography>
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

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 }, flex: 1, px: { xs: 2, sm: 3 }, pb: `max(32px, env(safe-area-inset-bottom, 0px))` }}>
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
            <Card variant="outlined" sx={{ height: "100%" }}>
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
            <Card variant="outlined" sx={{ height: "100%" }}>
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
            <Card variant="outlined" sx={{ height: "100%" }}>
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
      </Container>
    </Box>
  );
}
