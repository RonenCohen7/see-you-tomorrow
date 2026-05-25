import { Box, CircularProgress, Typography } from "@mui/material";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../store/authContext";
import { applyTokensFromCallbackHash } from "../utils/tenantAuth";
import api, { setTokens } from "../services/api";
import { defaultLandingForRole } from "../utils/roleRouting";
import type { Employee } from "../types/models";

/** Receives tokens from central login redirect (hash) and completes session on tenant subdomain. */
export default function LoginCallbackPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { refreshMe } = useAuth();

  useEffect(() => {
    const tokens = applyTokensFromCallbackHash();
    if (!tokens) {
      nav("/login", { replace: true });
      return;
    }
    setTokens(tokens.accessToken, tokens.refreshToken);
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      try {
        const { data } = await api.get<Employee>("/api/auth/me");
        await refreshMe();
        nav(defaultLandingForRole(data.role), { replace: true });
      } catch {
        nav("/login", { replace: true });
      }
    })();
  }, [nav, refreshMe]);

  return (
    <Box sx={{ minHeight: "40vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">{t("loginCallbackLoading")}</Typography>
    </Box>
  );
}
