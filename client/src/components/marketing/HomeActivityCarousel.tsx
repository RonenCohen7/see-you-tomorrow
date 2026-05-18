import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import GroupsIcon from "@mui/icons-material/Groups";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { alpha, Box, Chip, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { statusColors } from "../../theme/theme";
import { marqueeTrackSx } from "./landingTheme";

type ActivityCard = {
  id: string;
  titleKey: string;
  headerBg: string;
  icon: ReactNode;
  body: ReactNode;
};

function MiniCalendarBody() {
  const theme = useTheme();
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.4, mt: 1 }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const tone = i % 4 === 0 ? "office" : i % 3 === 0 ? "home" : "off";
        const bg =
          tone === "off"
            ? alpha(theme.palette.divider, 0.3)
            : alpha(statusColors[tone as keyof typeof statusColors], 0.35);
        return <Box key={i} sx={{ aspectRatio: "1", borderRadius: 0.75, bgcolor: bg }} />;
      })}
    </Box>
  );
}

function ActivityCardShell({
  title,
  headerBg,
  icon,
  children,
}: {
  title: string;
  headerBg: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: { xs: 260, sm: 300 },
        borderRadius: "18px",
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: "0 16px 40px -12px rgba(15, 23, 42, 0.2)",
        border: "1px solid",
        borderColor: "divider",
        mx: 1.5,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          background: headerBg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {icon}
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Box>
  );
}

export default function HomeActivityCarousel() {
  const { t } = useTranslation();
  const theme = useTheme();

  const cards: ActivityCard[] = [
    {
      id: "cal",
      titleKey: "calendar",
      headerBg: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, #ea580c 100%)`,
      icon: <CalendarMonthIcon fontSize="small" />,
      body: (
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {t("homeActivityCalendarHint")}
          </Typography>
          <MiniCalendarBody />
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={t("atOffice")} sx={{ bgcolor: alpha(statusColors.office, 0.15), height: 22 }} />
            <Chip size="small" label={t("atHome")} sx={{ bgcolor: alpha(statusColors.home, 0.15), height: 22 }} />
          </Stack>
        </Stack>
      ),
    },
    {
      id: "team",
      titleKey: "homeFeatureTeamTitle",
      headerBg: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
      icon: <GroupsIcon fontSize="small" />,
      body: (
        <Stack spacing={1}>
          {[t("homeActivityTeamRow1"), t("homeActivityTeamRow2"), t("homeActivityTeamRow3")].map((row) => (
            <Box
              key={row}
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.secondary.main, 0.08),
                typography: "caption",
                fontWeight: 600,
              }}
            >
              {row}
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            {t("homeActivityTeamHint")}
          </Typography>
        </Stack>
      ),
    },
    {
      id: "park",
      titleKey: "parking",
      headerBg: "linear-gradient(135deg, #22c55e 0%, #14b8a6 100%)",
      icon: <LocalParkingIcon fontSize="small" />,
      body: (
        <Stack spacing={1}>
          <Chip size="small" color="success" label={t("parkingCardVacant")} sx={{ alignSelf: "flex-start" }} />
          <Typography variant="caption" color="text.secondary">
            {t("homeActivityParkingHint")}
          </Typography>
        </Stack>
      ),
    },
    {
      id: "notif",
      titleKey: "notifications",
      headerBg: "linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)",
      icon: <NotificationsActiveIcon fontSize="small" />,
      body: (
        <Stack spacing={0.75}>
          {[t("homeActivityNotif1"), t("homeActivityNotif2")].map((line) => (
            <Box
              key={line}
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha("#a78bfa", 0.1),
                typography: "caption",
              }}
            >
              {line}
            </Box>
          ))}
        </Stack>
      ),
    },
    {
      id: "ai-rec",
      titleKey: "ai",
      headerBg: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 55%, #0ea5e9 100%)",
      icon: <AutoAwesomeIcon fontSize="small" />,
      body: (
        <Stack spacing={0.75}>
          <Chip size="small" label={t("homeActivityAiRecChip")} sx={{ alignSelf: "flex-start", fontWeight: 700 }} />
          {[t("homeActivityAiRecRow1"), t("homeActivityAiRecRow2")].map((line) => (
            <Box
              key={line}
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha("#8b5cf6", 0.1),
                typography: "caption",
                fontWeight: 600,
              }}
            >
              {line}
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            {t("homeAiRecPanelHint")}
          </Typography>
        </Stack>
      ),
    },
    {
      id: "assistant",
      titleKey: "homeActivityAssistantTitle",
      headerBg: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
      icon: <SmartToyOutlinedIcon fontSize="small" />,
      body: (
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary">
            {t("assistantHeaderSubtitle")}
          </Typography>
          {[t("assistantChipSchedules"), t("assistantChipManagerOffice")].map((chip) => (
            <Chip key={chip} size="small" label={chip} sx={{ justifyContent: "flex-start", height: "auto", py: 0.35, "& .MuiChip-label": { whiteSpace: "normal", textAlign: "start" } }} />
          ))}
        </Stack>
      ),
    },
  ];

  const track = [...cards, ...cards];

  return (
    <Box component="section" sx={{ position: "relative", zIndex: 1, py: { xs: 5, md: 7 }, overflow: "hidden" }}>
      <Typography
        variant="h4"
        textAlign="center"
        sx={{ fontWeight: 800, mb: 1, px: 2, fontSize: { xs: "1.35rem", md: "1.85rem" } }}
      >
        {t("homeActivityCarouselTitle")}
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4, px: 2, maxWidth: 560, mx: "auto" }}>
        {t("homeActivityCarouselSubtitle")}
      </Typography>

      <Box
        sx={{
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%)",
        }}
      >
        <Box sx={marqueeTrackSx(48)}>
          {track.map((card, i) => (
            <ActivityCardShell
              key={`${card.id}-${i}`}
              title={t(card.titleKey)}
              headerBg={card.headerBg}
              icon={card.icon}
            >
              {card.body}
            </ActivityCardShell>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
