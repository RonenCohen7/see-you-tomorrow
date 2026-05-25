import { alpha, AppBar, Avatar, Box, Button, Stack, Toolbar, Typography, useTheme } from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../store/authContext";
import PublicLanguageToggle from "./PublicLanguageToggle";
import { brandGradient } from "./marketing/brandGradient";
import { defaultLandingForRole } from "../utils/roleRouting";

type PublicHeaderProps = {
  variant?: "default" | "marketing";
};

/** Minimal top bar for public pages (home, login, register) */
export default function PublicHeader({ variant = "default" }: PublicHeaderProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMarketing = variant === "marketing";
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isMarketing) return;
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMarketing]);

  const marketingBg = scrolled
    ? alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.94 : 0.9)
    : "transparent";

  const compact = isMarketing;

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: isMarketing && !scrolled ? 0 : 1,
        borderColor: "divider",
        bgcolor: isMarketing ? marketingBg : "background.paper",
        backdropFilter: isMarketing && scrolled ? "saturate(180%) blur(14px)" : "none",
        WebkitBackdropFilter: isMarketing && scrolled ? "saturate(180%) blur(14px)" : "none",
        transition: theme.transitions.create(["background-color", "border-color", "backdrop-filter"], {
          duration: theme.transitions.duration.short,
        }),
        pt: "env(safe-area-inset-top, 0px)",
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          maxWidth: 1200,
          width: "100%",
          mx: "auto",
          px: { xs: 1.5, sm: 2 },
          flexWrap: "nowrap",
          gap: 1,
          minHeight: compact ? { xs: 48, sm: 52 } : { xs: 52, sm: 56 },
          py: compact ? 0.25 : { xs: 0.5, sm: 0.5 },
        }}
      >
        <Stack
          component={RouterLink}
          to="/"
          direction="row"
          alignItems="center"
          spacing={compact ? 2.25 : 2.75}
          sx={{
            flexGrow: 1,
            minWidth: 0,
            textDecoration: "none",
            color: "inherit",
            flexDirection: theme.direction === "rtl" ? "row" : "row-reverse",
          }}
        >
          <Avatar
            alt={t("appTitle")}
            src="/logo.png"
            sx={{
              width: compact ? 36 : 40,
              height: compact ? 36 : 40,
              flexShrink: 0,
              border: `2px solid ${alpha(theme.palette.primary.main, 0.22)}`,
              boxShadow: `0 4px 14px -4px ${alpha(theme.palette.primary.main, 0.4)}`,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={compact ? "subtitle1" : "h6"}
              sx={{
                fontWeight: 800,
                lineHeight: 1.15,
                fontSize: compact ? { xs: "0.95rem", sm: "1.05rem" } : undefined,
                background: brandGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {t("appTitle")}
            </Typography>
            {compact && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.1, fontSize: "0.65rem" }}
              >
                {t("homeHeaderTagline")}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          flexWrap="nowrap"
          justifyContent="flex-end"
          sx={{ flexShrink: 0 }}
        >
          <Button
            component={RouterLink}
            to="/support"
            color="inherit"
            size="small"
            sx={{ display: { xs: "none", md: "inline-flex" }, minWidth: 0, px: 1 }}
          >
            {t("publicNavSupport")}
          </Button>
          <Button
            component={RouterLink}
            to="/about"
            color="inherit"
            size="small"
            sx={{ display: { xs: "none", md: "inline-flex" }, minWidth: 0, px: 1 }}
          >
            {t("publicNavAbout")}
          </Button>
          <Button
            component={RouterLink}
            to="/pricing"
            color="inherit"
            size="small"
            sx={{ display: { xs: "none", md: "inline-flex" }, minWidth: 0, px: 1 }}
          >
            {t("publicNavPricing")}
          </Button>
          <PublicLanguageToggle />
          {user ? (
            <Button
              component={RouterLink}
              to={defaultLandingForRole(user.role)}
              variant="contained"
              color="primary"
              size="small"
            >
              {t("enterApp")}
            </Button>
          ) : (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Button
                component={RouterLink}
                to="/login"
                color="inherit"
                size="small"
                sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 } }}
              >
                {t("login")}
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="small"
                sx={{
                  minWidth: 0,
                  px: { xs: 1.25, sm: 2 },
                  fontWeight: 700,
                  background: brandGradient,
                  boxShadow: `0 4px 14px -4px ${alpha(theme.palette.primary.main, 0.5)}`,
                  "&:hover": { background: brandGradient, filter: "brightness(1.05)" },
                }}
              >
                {t("register")}
              </Button>
            </Stack>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
