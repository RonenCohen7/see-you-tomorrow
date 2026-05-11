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
import { useState } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";
import { useAuth } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({
        fullName,
        email,
        password,
        phone: phone || undefined,
        jobTitle: jobTitle || undefined,
      });
      nav("/dashboard", { state: { justRegistered: true } });
    } catch (err: unknown) {
      setError(apiErrorMessage(err, t("error")));
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
        </Paper>
      </Container>
    </Box>
  );
}
