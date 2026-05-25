import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
  Link,
  CircularProgress,
} from "@mui/material";
import { useCallback, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AppBrandTitle from "../components/AppBrandTitle";
import PublicHeader from "../components/PublicHeader";
import PublicTurnstileField, { hasTurnstileSiteKey } from "../components/PublicTurnstileField";
import { useAuth } from "../store/authContext";
import { apiErrorMessage, rateLimitRetrySecondsFromAxios } from "../utils/apiErrorMessage";
import { defaultLandingForRole } from "../utils/roleRouting";
import { isCentralLoginEnabled } from "../utils/tenantAuth";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const passwordResetDone = Boolean((location.state as { passwordResetDone?: boolean } | null)?.passwordResetDone);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);

  if (user) {
    return <Navigate to={defaultLandingForRole(user.role)} replace />;
  }

  async function doLogin(emailToUse: string, passwordToUse: string) {
    setLoading(true);
    setError(null);
    if (hasTurnstileSiteKey() && !turnstileToken?.trim()) {
      setError(t("turnstileRequired"));
      setLoading(false);
      return;
    }
    try {
      console.info("[login] POST /api/auth/login", { email: emailToUse });
      const signedIn = await login(emailToUse, passwordToUse, {
        turnstileToken,
        tenantSlug: tenantSlug.trim() || undefined,
      });
      if (signedIn === "redirect") return;
      nav(defaultLandingForRole(signedIn?.role ?? null));
    } catch (err: unknown) {
      console.error("[login] failed", err);
      const retrySec = rateLimitRetrySecondsFromAxios(err);
      setError(retrySec != null ? t("rateLimitRetryIn", { seconds: retrySec }) : apiErrorMessage(err, t("loginError")));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await doLogin(email, password);
  }

  async function quickDevLogin() {
    const devEmail = "ronenc7@gmail.com";
    const devPass = "12345678";
    setEmail(devEmail);
    setPassword(devPass);
    await doLogin(devEmail, devPass);
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
          <AppBrandTitle variant="compact" sx={{ mb: 2, justifyContent: "center" }} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            {t("login")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {t("tagline")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("loginSameForRoles")}
          </Typography>

          <Box component="form" onSubmit={submit}>
            {passwordResetDone && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {t("resetPasswordLoginHint")}
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label={t("email")}
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
            {isCentralLoginEnabled() && (
              <TextField
                fullWidth
                label={t("companySlug")}
                margin="normal"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder={t("companySlugHint")}
                helperText={t("companySlugHelp")}
              />
            )}
            <TextField
              fullWidth
              label={t("password")}
              margin="normal"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <PublicTurnstileField onTokenChange={onTurnstileChange} />
            <Box sx={{ mt: 0.5, textAlign: "start" }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2" underline="hover">
                {t("forgotPassword")}
              </Link>
            </Box>
            <Button fullWidth type="submit" variant="contained" sx={{ mt: 2 }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : t("login")}
            </Button>
          </Box>

          {import.meta.env.DEV && (
            <Box sx={{ mt: 3, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                כלי פיתוח — מנקה טוקנים ישנים ומבצע התחברות עם <code>ronenc7@gmail.com / 12345678</code>.
                ודא שהרצת <code>npm run ensure:dev-user</code>.
              </Typography>
              <Button
                fullWidth
                size="small"
                variant="outlined"
                color="secondary"
                onClick={quickDevLogin}
                disabled={loading}
              >
                התחברות מהירה כמשתמש פיתוח
              </Button>
            </Box>
          )}

          <Typography sx={{ mt: 2 }} variant="body2" color="text.secondary">
            {t("noAccount")}{" "}
            <Link component={RouterLink} to="/register">
              {t("register")}
            </Link>
          </Typography>
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
