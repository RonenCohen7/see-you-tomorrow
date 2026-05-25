import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Link,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";
import PublicTurnstileField, { hasTurnstileSiteKey } from "../components/PublicTurnstileField";
import api from "../services/api";
import { apiErrorMessage, rateLimitRetrySecondsFromAxios } from "../utils/apiErrorMessage";
import { isCentralLoginEnabled } from "../utils/tenantAuth";

type Step = "form" | "sent";

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(t("forgotPasswordSending"));
    if (hasTurnstileSiteKey() && !turnstileToken?.trim()) {
      setInfo(null);
      setError(t("turnstileRequired"));
      setLoading(false);
      return;
    }
    try {
      await api.post("/api/auth/forgot-password", {
        email: email.trim(),
        locale: i18n.language.startsWith("he") ? "he" : "en",
        ...(tenantSlug.trim() ? { tenantSlug: tenantSlug.trim() } : {}),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setStep("sent");
      setInfo(null);
    } catch (err: unknown) {
      setInfo(null);
      const retrySec = rateLimitRetrySecondsFromAxios(err);
      setError(retrySec != null ? t("rateLimitRetryIn", { seconds: retrySec }) : apiErrorMessage(err, t("forgotPasswordSendError")));
    } finally {
      setLoading(false);
    }
  }

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

          {step === "form" ? (
            <>
              <Typography color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-line" }}>
                {t("forgotPasswordIntro")}
              </Typography>
              <Box component="form" onSubmit={submit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                {info && !error && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {info}
                  </Alert>
                )}
                <TextField
                  required
                  fullWidth
                  type="email"
                  label={t("email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  sx={{ mb: 2 }}
                />
                {isCentralLoginEnabled() && (
                  <TextField
                    fullWidth
                    label={t("companySlug")}
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    helperText={t("companySlugHelp")}
                    sx={{ mb: 2 }}
                  />
                )}
                <PublicTurnstileField onTokenChange={onTurnstileChange} />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !email.trim()}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
                >
                  {loading ? t("forgotPasswordSending") : t("forgotPasswordSubmit")}
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2, whiteSpace: "pre-line" }}>
                {t("forgotPasswordSent", { email: email.trim() })}
              </Alert>
              {import.meta.env.DEV && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t("forgotPasswordDevMailhog")}{" "}
                  <Link href="http://localhost:8025" target="_blank" rel="noopener noreferrer">
                    localhost:8025
                  </Link>
                </Alert>
              )}
            </>
          )}

          <Button component={RouterLink} to="/login" variant="outlined" fullWidth sx={{ mt: 2 }}>
            {t("backToLogin")}
          </Button>
          <Typography sx={{ mt: 2 }} variant="body2">
            <Link component={RouterLink} to="/">
              {t("backHome")}
            </Link>
            {" · "}
            <Link component={RouterLink} to="/support">
              {t("publicNavSupport")}
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
