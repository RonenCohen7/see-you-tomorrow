import {
  Alert,
  Box,
  Button,
  Container,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  TextField,
  Typography,
  Link,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicHeader from "../components/PublicHeader";
import PublicTurnstileField, { hasTurnstileSiteKey } from "../components/PublicTurnstileField";
import { useAuth } from "../store/authContext";
import { apiErrorMessage, rateLimitRetrySecondsFromAxios } from "../utils/apiErrorMessage";
import { defaultLandingForRole } from "../utils/roleRouting";
import { isSharedSaasEnabled } from "../utils/tenantAuth";
import api from "../services/api";

type RegisterDepartment = { id: string; name: string };

export default function RegisterPage() {
  const { t } = useTranslation();
  const { register, registerOrganization, user } = useAuth();
  const sharedSaas = isSharedSaasEnabled();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [tenantSlug, setTenantSlug] = useState(searchParams.get("tenant") ?? "");
  const [organizationName, setOrganizationName] = useState("");
  const [mode, setMode] = useState<"create" | "join">(inviteToken ? "join" : "create");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<RegisterDepartment[]>([]);
  const [departmentsStatus, setDepartmentsStatus] = useState<"idle" | "loading" | "ok" | "notFound">("idle");
  const departmentsLoading = departmentsStatus === "loading";
  const [departmentId, setDepartmentId] = useState("");

  const onTurnstileChange = useCallback((t: string | null) => setTurnstileToken(t), []);
  const joinExisting = !sharedSaas || mode === "join" || Boolean(inviteToken);
  const slugForLookup = tenantSlug.trim().toLowerCase();

  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setEmail(prefill);
  }, [searchParams]);

  useEffect(() => {
    if (!joinExisting || (sharedSaas && !inviteToken && !slugForLookup)) {
      setDepartments([]);
      setDepartmentsStatus("idle");
      return;
    }
    let cancelled = false;
    setDepartmentsStatus("loading");
    const timer = window.setTimeout(() => {
      const body: Record<string, string> = {};
      if (inviteToken) body.inviteToken = inviteToken;
      else if (slugForLookup) body.tenantSlug = slugForLookup;
      api
        .post<{ items: RegisterDepartment[] }>("/api/auth/register-departments", body)
        .then(({ data }) => {
          if (cancelled) return;
          setDepartments(data.items ?? []);
          setDepartmentsStatus("ok");
        })
        .catch(() => {
          if (cancelled) return;
          setDepartments([]);
          setDepartmentsStatus("notFound");
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [joinExisting, sharedSaas, inviteToken, slugForLookup]);

  useEffect(() => {
    if (departmentId && !departments.some((d) => d.id === departmentId)) setDepartmentId("");
  }, [departments, departmentId]);

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
    if (joinExisting && departments.length > 0 && !departmentId) {
      setError(t("registerDepartmentRequired"));
      setLoading(false);
      return;
    }
    try {
      const registered = joinExisting
        ? await register({
            fullName,
            email,
            password,
            phone: phone || undefined,
            jobTitle: jobTitle || undefined,
            departmentId: departmentId || undefined,
            turnstileToken,
            inviteToken: inviteToken || undefined,
            tenantSlug: tenantSlug.trim() || undefined,
          })
        : await registerOrganization({
            organizationName,
            slug: tenantSlug,
            fullName,
            email,
            password,
            phone: phone || undefined,
            jobTitle: jobTitle || undefined,
            turnstileToken,
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
            {sharedSaas && !inviteToken && (
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={mode}
                onChange={(_e, value: "create" | "join" | null) => {
                  if (value) setMode(value);
                }}
                sx={{ mb: 2 }}
              >
                <ToggleButton value="create">{t("saasCreateOrg")}</ToggleButton>
                <ToggleButton value="join">{t("saasJoinOrg")}</ToggleButton>
              </ToggleButtonGroup>
            )}
            {sharedSaas && mode === "create" && !inviteToken && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t("registerOrgHint")}
              </Typography>
            )}
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
            {sharedSaas && mode === "create" && !inviteToken && (
              <TextField
                fullWidth
                required
                label={t("organizationName")}
                margin="normal"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            )}
            {sharedSaas && !inviteToken && (
              <TextField
                fullWidth
                required
                label={mode === "create" ? t("organizationSlug") : t("companySlug")}
                margin="normal"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                helperText={mode === "create" ? t("organizationSlugHelp") : t("companySlugHelp")}
              />
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
            <TextField
              fullWidth
              required={joinExisting}
              label={t("jobTitle")}
              margin="normal"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            {joinExisting && (
              <TextField
                select
                fullWidth
                required={departmentsStatus !== "ok" || departments.length > 0}
                label={t("registerDepartment")}
                margin="normal"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={departmentsStatus !== "ok" || departments.length === 0}
                error={departmentsStatus === "notFound"}
                helperText={
                  departmentsStatus === "idle"
                    ? t("registerDepartmentNeedCompany")
                    : departmentsStatus === "loading"
                      ? t("registerDepartmentsLoading")
                      : departmentsStatus === "notFound"
                        ? t("registerDepartmentCompanyNotFound")
                        : departments.length === 0
                          ? t("registerDepartmentNoneInOrg")
                          : t("registerDepartmentHelp")
                }
              >
                {departments.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </TextField>
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
