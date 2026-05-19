import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Box, Button, Chip, Container, Stack, Typography, alpha, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import AppBrandTitle from "../AppBrandTitle";
import HomeProductScreenshot from "./HomeProductScreenshot";

export default function HomeHeroSection() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box component="section" sx={{ py: { xs: 4, md: 8 }, position: "relative", zIndex: 1 }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: { xs: 4, lg: 6 },
            alignItems: "center",
          }}
        >
          <Stack spacing={2.5} sx={{ textAlign: { xs: "center", lg: "start" }, order: { xs: 1, lg: 0 } }}>
            <AppBrandTitle variant="hero" />
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ fontWeight: 400, fontSize: { xs: "1.05rem", md: "1.2rem" }, maxWidth: 520, mx: { xs: "auto", lg: 0 } }}
            >
              {t("homeHeroSubtitle")}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ pt: 0.5, justifyContent: { xs: "center", lg: "flex-start" } }}
            >
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                size="large"
                sx={{ px: 3, py: 1.1, fontWeight: 700 }}
              >
                {t("loginUserOrAdmin")}
              </Button>
              <Button component={RouterLink} to="/register" variant="outlined" size="large" sx={{ px: 3, py: 1.1, fontWeight: 600 }}>
                {t("register")}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {t("homeCtaTrust")}
            </Typography>
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              justifyContent={{ xs: "center", lg: "flex-start" }}
              sx={{ pt: 0.5 }}
            >
              <Chip
                size="small"
                icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
                label={t("ai")}
                sx={{ fontWeight: 600, bgcolor: alpha("#a78bfa", 0.12), border: `1px solid ${alpha("#a78bfa", 0.25)}` }}
              />
              <Chip
                size="small"
                icon={<SmartToyOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                label={t("assistantHeaderTitle")}
                sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.1) }}
              />
            </Stack>
            <Button
              component={RouterLink}
              to="/login"
              color="primary"
              endIcon={<CalendarMonthIcon />}
              sx={{ alignSelf: { xs: "center", lg: "flex-start" } }}
            >
              {t("homeCalendarTeaser")}
            </Button>
          </Stack>

          <Box sx={{ order: { xs: 0, lg: 1 } }}>
            <HomeProductScreenshot />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
