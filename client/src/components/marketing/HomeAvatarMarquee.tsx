import { Avatar, Box, Typography, alpha, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LANDING_TEAM_AVATARS } from "./landingAvatars";
import { marqueeTrackSx } from "./landingTheme";

function AvatarBubble({
  name,
  photo,
  accent,
  size,
  lift,
}: {
  name: string;
  photo: string;
  accent: string;
  size: number;
  lift?: boolean;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flexShrink: 0,
        mx: { xs: -0.75, sm: -1 },
        transform: lift ? "translateY(-8px) scale(1.08)" : "none",
        zIndex: lift ? 2 : 1,
        transition: "transform 0.3s ease",
      }}
    >
      <Avatar
        src={photo}
        alt={name}
        sx={{
          width: size,
          height: size,
          border: `3px solid ${theme.palette.background.paper}`,
          boxShadow: `0 8px 20px -4px ${alpha(accent, 0.45)}`,
          bgcolor: accent,
        }}
      />
    </Box>
  );
}

export default function HomeAvatarMarquee() {
  const { t } = useTranslation();
  const items = [...LANDING_TEAM_AVATARS, ...LANDING_TEAM_AVATARS];

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        zIndex: 1,
        py: { xs: 4, md: 5 },
        overflow: "hidden",
      }}
    >
      <Typography
        variant="h5"
        textAlign="center"
        sx={{ fontWeight: 800, mb: 3, px: 2, fontSize: { xs: "1.15rem", md: "1.4rem" } }}
      >
        {t("homeAvatarMarqueeTitle")}
      </Typography>

      <Box
        sx={{
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
          py: 2,
        }}
      >
        <Box sx={marqueeTrackSx(36)}>
          {items.map((person, i) => {
            const centerBoost = i % LANDING_TEAM_AVATARS.length === 5 || i % LANDING_TEAM_AVATARS.length === 6;
            return (
              <AvatarBubble
                key={`${person.name}-${i}`}
                name={person.name}
                photo={person.photo}
                accent={person.accent}
                size={centerBoost ? 72 : 56}
                lift={centerBoost}
              />
            );
          })}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 1, px: 2 }}>
        {t("homeAvatarMarqueeSubtitle")}
      </Typography>
    </Box>
  );
}
