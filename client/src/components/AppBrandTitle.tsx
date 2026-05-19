import { Avatar, Box, Stack, Typography, alpha, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { heroGradientTextSx, heroTitleSx } from "./marketing/landingTheme";

type AppBrandTitleProps = {
  /** Hero on home vs compact on login card */
  variant?: "hero" | "compact";
  sx?: SxProps<Theme>;
};

export default function AppBrandTitle({ variant = "hero", sx }: AppBrandTitleProps) {
  const theme = useTheme();
  const compact = variant === "compact";

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={compact ? 2 : { xs: 2, md: 2.75 }}
      sx={{
        flexDirection: theme.direction === "rtl" ? "row" : "row-reverse",
        justifyContent: compact ? "flex-start" : { xs: "center", lg: "flex-start" },
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="h1"
          sx={{
            ...(heroTitleSx as object),
            fontSize: compact
              ? { xs: "1.35rem", sm: "1.65rem" }
              : { xs: "1.85rem", sm: "2.35rem", md: "clamp(2rem, 4vw, 3.25rem)" },
            lineHeight: 1.1,
            m: 0,
          }}
        >
          <Box component="span" sx={{ color: "text.primary" }}>
            See You{" "}
          </Box>
          <Box component="span" sx={heroGradientTextSx}>
            Tomorrow
          </Box>
        </Typography>
      </Box>
      <Avatar
        alt="See You Tomorrow"
        src="/logo.png"
        sx={{
          width: compact ? 40 : { xs: 52, sm: 56, md: 64 },
          height: compact ? 40 : { xs: 52, sm: 56, md: 64 },
          flexShrink: 0,
          border: `2px solid ${alpha(theme.palette.primary.main, 0.22)}`,
          boxShadow: `0 6px 18px -4px ${alpha(theme.palette.primary.main, 0.4)}`,
        }}
      />
    </Stack>
  );
}
