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
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";
import PublicTurnstileField, { hasTurnstileSiteKey } from "../components/PublicTurnstileField";
import { useAuth } from "../store/authContext";
import { apiErrorMessage, rateLimitRetrySecondsFromAxios } from "../utils/apiErrorMessage";
import { defaultLandingForRole } from "../utils/roleRouting";
import { isCentralLoginEnabled } from "../utils/tenantAuth";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [tenantSlug, setTenantSlug] = useState(searchParams.get("tenant") ?? "");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);

  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  if (user) {
    return <Navigate to={defaultLandingForRole(user.role)} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (hasTurnstileSiteKey() && !turnstileToken?.trim()) {
      setError(t("turnstileRequired"));
      setLoading(false);
      return;
    }
    try {
      const registered = await register({
        fullName,
        email,
        password,
        phone: phone || undefined,
        jobTitle: jobTitle || undefined,
        turnstileToken,
        inviteToken: inviteToken || undefined,
        tenantSlug: tenantSlug.trim() || undefined,
      });
      if (registered === "redirect") return;
      nav(defaultLandingForRole(registered?.role ?? null), { state: { justRegistered: true } });
    } catch (err: unknown) {
      const retrySec = rateLimitRetrySecondsFromAxios(err);
      setError(retrySec != null ? t("rateLimitRetryIn", { seconds: retrySec }) : apiErrorMessage(err, t("error")));
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
            {t("register")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t("registerSubtitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("registerHint")}
          </Typography>

          <Box component="form" onSubmit={submit}>
            {inviteToken && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("inviteRegisterHint")}
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              required
              label={t("fullName")}
              margin="normal"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <TextField
              fullWidth
              required
              label={t("email")}
              margin="normal"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <TextField
              fullWidth
              required
              label={t("password")}
              margin="normal"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              helperText={t("passwordHint")}
            />
            <TextField fullWidth label={t("phone")} margin="normal" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField fullWidth label={t("jobTitle")} margin="normal" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            {(isCentralLoginEnabled() || inviteToken) && !inviteToken && (
              <TextField
                fullWidth
                label={t("companySlug")}
                margin="normal"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                helperText={t("companySlugHelp")}
              />
            )}
            <PublicTurnstileField onTokenChange={onTurnstileChange} />
            <Button fullWidth type="submit" variant="contained" sx={{ mt: 3 }} disabled={loading}>
              {loading ? <CircularProgress size={24} color="inherit" /> : t("register")}
            </Button>
          </Box>

          <Typography sx={{ mt: 2 }} variant="body2" color="text.secondary">
            {t("haveAccount")}{" "}
            <Link component={RouterLink} to="/login">
              {t("login")}
            </Link>
            {" · "}
            <Link component={RouterLink} to="/forgot-password">
              {t("forgotPassword")}
            </Link>
          </Typography>
          <Typography sx={{ mt: 1 }} variant="body2" color="text.secondary">
            {t("supportNeedHelp")}{" "}
            <Link component={RouterLink} to="/support">
              {t("publicNavSupport")}
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
