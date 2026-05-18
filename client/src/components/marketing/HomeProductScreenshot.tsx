import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { Box, Chip, Stack, Typography, alpha, useTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { statusColors } from "../../theme/theme";
import { LANDING_RADIUS, productFrameShadow } from "./landingTheme";

const SCREENSHOT_PATHS = {
  he: "/marketing/home-product-he.png",
  en: "/marketing/home-product-en.png",
  fallback: "/marketing/home-product.png",
} as const;

function ProductMockFallback() {
  const { t } = useTranslation();
  const theme = useTheme();
  const days = useMemo(() => ["M", "T", "W", "T", "F", "S", "S"], []);
  const statuses = [
    { key: "office", label: t("atOffice") },
    { key: "home", label: t("atHome") },
    { key: "vacation", label: t("vacation") },
  ] as const;

  return (
    <Box
      sx={{
        p: 2,
        minHeight: 280,
        bgcolor: theme.palette.background.paper,
        borderRadius: `${LANDING_RADIUS - 4}px`,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {t("calendar")}
        </Typography>
        <Chip size="small" label={t("homeHeroBadge")} color="primary" variant="outlined" />
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.5,
          mb: 2,
        }}
      >
        {days.map((d, i) => (
          <Typography key={i} variant="caption" color="text.secondary" textAlign="center" fontWeight={600}>
            {d}
          </Typography>
        ))}
        {Array.from({ length: 28 }).map((_, i) => {
          const tone = i % 7 === 2 ? "office" : i % 5 === 0 ? "home" : i % 11 === 0 ? "vacation" : "off";
          const bg =
            tone === "off"
              ? alpha(theme.palette.divider, 0.35)
              : alpha(statusColors[tone], theme.palette.mode === "dark" ? 0.35 : 0.22);
          return (
            <Box
              key={i}
              sx={{
                aspectRatio: "1",
                borderRadius: 1,
                bgcolor: bg,
                border: i === 10 ? `2px solid ${theme.palette.primary.main}` : "none",
              }}
            />
          );
        })}
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {statuses.map((s) => (
          <Chip
            key={s.key}
            size="small"
            label={s.label}
            sx={{
              bgcolor: alpha(statusColors[s.key], 0.15),
              color: statusColors[s.key],
              fontWeight: 600,
              border: "none",
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default function HomeProductScreenshot() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [srcStage, setSrcStage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const srcCandidates = useMemo(() => {
    const primary = i18n.language.startsWith("he") ? SCREENSHOT_PATHS.he : SCREENSHOT_PATHS.en;
    return [primary, SCREENSHOT_PATHS.fallback];
  }, [i18n.language]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    setSrcStage(0);
  }, [i18n.language]);

  const showImage = srcStage < srcCandidates.length;
  const src = showImage ? srcCandidates[srcStage] : "";

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 560,
        mx: "auto",
        transform: reduceMotion ? "none" : { md: "perspective(1200px) rotateY(-4deg) rotateX(2deg)" },
        transition: "transform 0.4s ease",
        "@media (prefers-reduced-motion: reduce)": { transform: "none" },
      }}
    >
      <Box
        sx={{
          borderRadius: `${LANDING_RADIUS}px`,
          overflow: "hidden",
          boxShadow: productFrameShadow,
          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          bgcolor: theme.palette.background.paper,
          p: { xs: 1, sm: 1.25 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.75,
            borderBottom: 1,
            borderColor: "divider",
            mb: 1,
          }}
        >
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#ef4444" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#f59e0b" }} />
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#22c55e" }} />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: "center", fontWeight: 600 }}>
            See You Tomorrow
          </Typography>
          <CalendarMonthIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        </Box>
        {showImage ? (
          <Box
            component="img"
            src={src}
            alt={t("homeProductScreenshotAlt")}
            onError={() => setSrcStage((s) => s + 1)}
            sx={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: `${LANDING_RADIUS - 6}px`,
              verticalAlign: "middle",
            }}
          />
        ) : (
          <ProductMockFallback />
        )}
      </Box>
    </Box>
  );
}
