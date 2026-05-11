import { Box, Button, Container, Link, Paper, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <PublicHeader />
      <Container
        maxWidth="sm"
        sx={{
          mt: { xs: 2, sm: 4 },
          mb: { xs: 3, sm: 6 },
          px: { xs: 2, sm: 3 },
          pb: `max(24px, env(safe-area-inset-bottom, 0px))`,
          boxSizing: "border-box",
        }}
      >
        <Paper sx={{ p: { xs: 2, sm: 4 } }}>
          <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
            {t("forgotPasswordTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-line" }}>
            {t("forgotPasswordInfo")}
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained" fullWidth sx={{ mt: 2 }}>
            {t("backToLogin")}
          </Button>
          <Typography sx={{ mt: 2 }} variant="body2">
            <Link component={RouterLink} to="/">
              {t("backHome")}
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
