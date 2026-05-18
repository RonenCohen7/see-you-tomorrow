import { alpha, Box, Button, Container, Stack, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { ctaGradient } from "./brandGradient";

export default function HomeCtaBand() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        zIndex: 1,
        py: { xs: 5, md: 7 },
        mx: { xs: 2, sm: 3, md: 4 },
        mb: { xs: 2, md: 3 },
        borderRadius: `${20}px`,
        background: isDark
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.55)} 0%, ${alpha("#6366f1", 0.35)} 50%, ${alpha("#1e293b", 0.95)} 100%)`
          : ctaGradient,
        color: "#fff",
        textAlign: "center",
        boxShadow: "0 20px 40px -16px rgba(249, 115, 22, 0.35)",
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={2} alignItems="center">
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800, fontSize: { xs: "1.35rem", md: "1.75rem" } }}>
            {t("homeFinalCtaTitle")}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 480 }}>
            {t("homeFinalCtaSubtitle")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              sx={{
                bgcolor: "#fff",
                color: theme.palette.primary.main,
                fontWeight: 700,
                px: 3,
                "&:hover": { bgcolor: alpha("#fff", 0.92) },
              }}
            >
              {t("register")}
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              size="large"
              sx={{
                borderColor: alpha("#fff", 0.7),
                color: "#fff",
                px: 3,
                "&:hover": { borderColor: "#fff", bgcolor: alpha("#fff", 0.1) },
              }}
            >
              {t("login")}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
