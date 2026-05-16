import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../store/authContext";
import PublicLanguageToggle from "./PublicLanguageToggle";

/** Minimal top bar for public pages (home, login, register) */
export default function PublicHeader() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        pt: "env(safe-area-inset-top, 0px)",
      }}
    >
      <Toolbar
        sx={{
          maxWidth: 1200,
          width: "100%",
          mx: "auto",
          flexWrap: "wrap",
          rowGap: 1,
          py: { xs: 1, sm: 0.5 },
          minHeight: { xs: "auto", sm: 56 },
        }}
      >
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{ flexGrow: 1, textDecoration: "none", color: "primary.main", fontWeight: 700 }}
        >
          {t("appTitle")}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          <PublicLanguageToggle />
          {user ? (
            <Button component={RouterLink} to="/dashboard" variant="contained" color="primary">
              {t("enterApp")}
            </Button>
          ) : (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Button component={RouterLink} to="/login" color="inherit">
                {t("login")}
              </Button>
              <Button component={RouterLink} to="/register" variant="contained">
                {t("register")}
              </Button>
            </Box>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
