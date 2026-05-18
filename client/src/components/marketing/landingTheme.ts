import type { SxProps, Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";
import { alpha } from "@mui/material/styles";

export const LANDING_RADIUS = 20;
export const LANDING_CARD_RADIUS = 16;

export const productFrameShadow =
  "0 24px 48px -12px rgba(15, 23, 42, 0.18), 0 12px 24px -8px rgba(249, 115, 22, 0.12)";

export const featureCardShadow = "0 4px 24px -4px rgba(15, 23, 42, 0.08)";

export function landingPageRootSx(theme: Theme): SystemStyleObject<Theme> {
  const isDark = theme.palette.mode === "dark";
  return {
    position: "relative",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    overflow: "hidden",
    bgcolor: isDark ? theme.palette.background.default : "#fafaf9",
  };
}

export function landingGradientBlobsSx(theme: Theme): SystemStyleObject<Theme> {
  const isDark = theme.palette.mode === "dark";
  const o = isDark ? 0.28 : 0.55;
  return {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      width: "min(720px, 90vw)",
      height: "min(720px, 90vw)",
      borderRadius: "50%",
      top: "-18%",
      insetInlineStart: "-12%",
      background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, o)} 0%, transparent 68%)`,
      filter: "blur(40px)",
    },
    "&::after": {
      content: '""',
      position: "absolute",
      width: "min(560px, 75vw)",
      height: "min(560px, 75vw)",
      borderRadius: "50%",
      top: "8%",
      insetInlineEnd: "-8%",
      background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, o * 0.9)} 0%, transparent 70%)`,
      filter: "blur(48px)",
    },
  };
}

export function landingVioletBlobSx(theme: Theme): SystemStyleObject<Theme> {
  const isDark = theme.palette.mode === "dark";
  return {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: "50%",
    bottom: "12%",
    left: "50%",
    transform: "translateX(-50%)",
    background: `radial-gradient(circle, ${alpha("#a78bfa", isDark ? 0.12 : 0.22)} 0%, transparent 70%)`,
    filter: "blur(56px)",
    pointerEvents: "none",
  };
}

export function landingEmeraldBlobSx(theme: Theme): SystemStyleObject<Theme> {
  const isDark = theme.palette.mode === "dark";
  return {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: "50%",
    top: "42%",
    insetInlineStart: "8%",
    background: `radial-gradient(circle, ${alpha("#22c55e", isDark ? 0.1 : 0.18)} 0%, transparent 70%)`,
    filter: "blur(48px)",
    pointerEvents: "none",
  };
}

export const heroTitleSx: SxProps<Theme> = {
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.12,
  fontSize: { xs: "2rem", sm: "2.5rem", md: "clamp(2.25rem, 4.5vw, 3.5rem)" },
};

export const heroGradientTextSx: SxProps<Theme> = {
  background: "linear-gradient(135deg, #ea580c 0%, #f97316 35%, #0ea5e9 70%, #8b5cf6 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

/** Infinite horizontal marquee — duplicate content in DOM for seamless loop. */
export function marqueeTrackSx(durationSec = 40): SxProps<Theme> {
  return (theme: Theme) => ({
    display: "flex",
    width: "max-content",
    animation:
      theme.direction === "rtl"
        ? `sytMarqueeRtl ${durationSec}s linear infinite`
        : `sytMarquee ${durationSec}s linear infinite`,
    "@keyframes sytMarquee": {
      "0%": { transform: "translateX(0)" },
      "100%": { transform: "translateX(-50%)" },
    },
    "@keyframes sytMarqueeRtl": {
      "0%": { transform: "translateX(0)" },
      "100%": { transform: "translateX(50%)" },
    },
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  });
}
