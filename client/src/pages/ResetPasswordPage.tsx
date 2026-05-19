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
import { useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";
import api from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordOk = password.length >= 8;
  const matchOk = password === confirm && confirm.length > 0;
  const canSubmit = Boolean(token) && passwordOk && matchOk && !loading;

  if (!token) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
        <PublicHeader />
        <Container maxWidth="sm" sx={{ mt: 4, px: 2 }}>
          <Paper sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t("resetPasswordMissingToken")}
            </Alert>
            <Button component={RouterLink} to="/forgot-password" variant="contained" fullWidth>
              {t("forgotPasswordTitle")}
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (done) {
    return <Navigate to="/login" replace state={{ passwordResetDone: true }} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchOk) {
      setError(t("resetPasswordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(t("resetPasswordSaving"));
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setInfo(t("resetPasswordSuccess"));
      setDone(true);
    } catch (err: unknown) {
      setInfo(null);
      setError(apiErrorMessage(err, t("resetPasswordError")));
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
            {t("resetPasswordTitle")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t("resetPasswordIntro")}
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
              type="password"
              label={t("resetPasswordNew")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              helperText={!passwordOk && password ? t("passwordHint") : undefined}
              error={password.length > 0 && !passwordOk}
              sx={{ mb: 2 }}
            />
            <TextField
              required
              fullWidth
              type="password"
              label={t("resetPasswordConfirm")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              error={confirm.length > 0 && !matchOk}
              helperText={confirm.length > 0 && !matchOk ? t("resetPasswordMismatch") : undefined}
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!canSubmit}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {loading ? t("resetPasswordSaving") : t("resetPasswordSubmit")}
            </Button>
          </Box>

          <Button component={RouterLink} to="/login" variant="text" fullWidth sx={{ mt: 2 }}>
            {t("backToLogin")}
          </Button>
          <Typography sx={{ mt: 2 }} variant="body2">
            <Link component={RouterLink} to="/forgot-password">
              {t("forgotPassword")}
            </Link>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
