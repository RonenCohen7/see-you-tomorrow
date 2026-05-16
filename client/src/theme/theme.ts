import { createTheme, alpha } from "@mui/material/styles";

/**
 * Modern, vibrant status colors — orange/red-orange/sky/green family.
 */
export const statusColors = {
  office: "#0ea5e9",   // משרד — תכלת
  home: "#f97316",     // בית — כתום
  vacation: "#22c55e", // חופשה — ירוק
  sick: "#ef4444",     // מחלה — אדום-כתום
  off: "#94a3b8",      // לא עובד — אפור צונן
} as const;

export type StatusKey = keyof typeof statusColors;

export function statusBg(status: StatusKey, mode: "light" | "dark") {
  return alpha(statusColors[status], mode === "dark" ? 0.22 : 0.12);
}

/**
 * Modern palette:
 * - primary: orange (#f97316) — vibrant, energetic
 * - secondary: sky (#0ea5e9)
 * - Accents: emerald green, red-orange
 * - Surfaces: near-white with cool/warm tint; dark = slate.
 */
export function buildTheme(mode: "light" | "dark", direction: "rtl" | "ltr") {
  const isDark = mode === "dark";

  const primaryMain = isDark ? "#fb923c" : "#f97316";
  const secondaryMain = isDark ? "#38bdf8" : "#0ea5e9";

  const surface = isDark ? "#0f172a" : "#ffffff";
  const surfaceAlt = isDark ? "#1e293b" : "#fafaf9";

  return createTheme({
    direction,
    palette: {
      mode,
      primary: { main: primaryMain, contrastText: "#ffffff" },
      secondary: { main: secondaryMain, contrastText: "#ffffff" },
      success: { main: "#22c55e" },
      warning: { main: "#f59e0b" },
      error: { main: "#ef4444" },
      info: { main: "#0ea5e9" },
      background: isDark
        ? { default: "#0b1220", paper: surface }
        : { default: surfaceAlt, paper: surface },
      text: isDark
        ? { primary: "#f1f5f9", secondary: "#94a3b8" }
        : { primary: "#0f172a", secondary: "#475569" },
      divider: isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: '"Assistant", "Heebo", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700, letterSpacing: "-0.01em" },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      button: { fontWeight: 600, textTransform: "none" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            WebkitTextSizeAdjust: "100%",
            minWidth: 0,
            overflowX: "auto",
          },
          body: {
            direction,
            minWidth: 0,
            overflowX: "auto",
            overflowY: "auto",
            backgroundImage: isDark
              ? "radial-gradient(at 0% 0%, rgba(249,115,22,0.10) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(14,165,233,0.10) 0px, transparent 50%)"
              : "radial-gradient(at 0% 0%, rgba(249,115,22,0.06) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(14,165,233,0.06) 0px, transparent 50%)",
            backgroundAttachment: "fixed",
          },
          "#root": {
            minHeight: "100dvh",
            minWidth: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: isDark
              ? "linear-gradient(120deg, #1e293b 0%, #0f172a 100%)"
              : "linear-gradient(120deg, #f97316 0%, #ef4444 45%, #0ea5e9 100%)",
            boxShadow: "0 4px 20px -8px rgba(15,23,42,0.25)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            background: isDark
              ? "linear-gradient(135deg, rgba(30,41,59,0.70) 0%, rgba(15,23,42,0.55) 100%)"
              : "linear-gradient(135deg, rgba(255,255,255,0.80) 0%, rgba(255,255,255,0.55) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: isDark ? "1px solid rgba(148,163,184,0.14)" : "1px solid rgba(15,23,42,0.06)",
            boxShadow: isDark
              ? "0 4px 24px -10px rgba(0,0,0,0.6)"
              : "0 4px 24px -12px rgba(15,23,42,0.12)",
            transition: "transform 220ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease, border-color 220ms",
            "&:hover": {
              boxShadow: isDark
                ? "0 12px 36px -14px rgba(0,0,0,0.7), 0 0 0 1px rgba(251,146,60,0.25)"
                : "0 14px 36px -18px rgba(15,23,42,0.22), 0 0 0 1px rgba(249,115,22,0.22)",
              borderColor: isDark ? "rgba(251,146,60,0.32)" : "rgba(249,115,22,0.32)",
            },
            // tiles that opt-in (stat / nav) get the lift
            "&.syt-lift:hover": {
              transform: "translateY(-3px)",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, paddingInline: 18 },
          contained: {
            boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 8px 22px -10px rgba(249,115,22,0.55)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 16 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            marginInline: 8,
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14),
              color: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2),
              },
            },
          }),
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 13,
            paddingInline: 10,
            paddingBlock: 6,
            backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(15,23,42,0.92)",
          },
          arrow: {
            color: isDark ? "rgba(15,23,42,0.95)" : "rgba(15,23,42,0.92)",
          },
        },
      },
      MuiDialog: {
        defaultProps: { scroll: "paper" },
        styleOverrides: {
          paper: ({ theme }) => ({
            margin: theme.spacing(2),
            maxHeight: "calc(100dvh - 32px)",
            [theme.breakpoints.down("sm")]: {
              margin: 0,
              width: "100%",
              maxWidth: "100%",
              maxHeight: "100dvh",
            },
          }),
        },
      },
    },
  });
}
