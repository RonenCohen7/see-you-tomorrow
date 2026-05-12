import { Box, alpha, useTheme } from "@mui/material";
import { useEffect, useRef, useState } from "react";

/**
 * Same clip as Dashboard: Mixkit «team» office (muted, loop).
 * Override with VITE_DASHBOARD_BG_VIDEO_URL or VITE_SITE_BG_VIDEO_URL (mp4).
 */
export const DEFAULT_SITE_BG_VIDEO = "https://assets.mixkit.co/videos/6095/6095-720.mp4";

/** Full-bleed cover video + readable scrim. `position: absolute; inset 0` — parent must be `position: relative`. */
export function MutedBackdropVideo() {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduceMotion) return;
    void v.play().catch(() => {});
  }, [reduceMotion]);

  const custom =
    (import.meta.env.VITE_DASHBOARD_BG_VIDEO_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_SITE_BG_VIDEO_URL as string | undefined)?.trim();

  const bg = theme.palette.background.default;

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        borderRadius: 0,
      }}
    >
      {!reduceMotion ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%) scale(1.08)",
            minWidth: "100%",
            minHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "cover",
          }}
        >
          {custom ? <source src={custom} type="video/mp4" /> : null}
          <source src={DEFAULT_SITE_BG_VIDEO} type="video/mp4" />
        </video>
      ) : (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.dark, 0.1)} 100%)`,
          }}
        />
      )}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            theme.palette.mode === "dark"
              ? `linear-gradient(180deg, ${alpha(bg, 0.72)} 0%, ${alpha(bg, 0.52)} 42%, ${alpha(bg, 0.38)} 100%)`
              : `linear-gradient(180deg, ${alpha(bg, 0.68)} 0%, ${alpha(bg, 0.48)} 45%, ${alpha(bg, 0.34)} 100%)`,
        }}
      />
    </Box>
  );
}
