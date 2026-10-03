import { Box, Card, Chip, Stack, Typography, alpha, useTheme } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import { useTranslation } from "react-i18next";
import type { Employee, Schedule } from "../types/models";
import type { StatusKey } from "../theme/theme";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import { isBuiltinScheduleStatus } from "../utils/scheduleStatusKinds";
import { CUSTOM_SCHEDULE_STATUS_UI_COLOR } from "../utils/scheduleStatusUi";

type Props = {
  iso: string;
  weekdayLong: string;
  dayNum: number;
  monthShort: string;
  isToday: boolean;
  schedules: Schedule[];
  employeeMap: Map<string, Employee>;
  sortLocale: string;
  leaderOfficeMissing: boolean;
  birthdayNames: string[];
  parkingCount: number;
  meetingCount: number;
  onPick: (iso: string) => void;
};

/** Phone layout for one day of the 7-day view: who is where, by status, in a full-width row. */
export function CalendarSevenDayAgendaRow({
  iso,
  weekdayLong,
  dayNum,
  monthShort,
  isToday,
  schedules,
  employeeMap,
  sortLocale,
  leaderOfficeMissing,
  birthdayNames,
  parkingCount,
  meetingCount,
  onPick,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rtl = theme.direction === "rtl";

  const namesByStatus = new Map<StatusKey, Set<string>>();
  const customNames = new Set<string>();
  for (const s of schedules) {
    const name = employeeMap.get(s.employeeId)?.fullName?.trim() || `…${s.employeeId.slice(-6)}`;
    if (isBuiltinScheduleStatus(s.status)) {
      const k = s.status as StatusKey;
      const set = namesByStatus.get(k) ?? new Set<string>();
      set.add(name);
      namesByStatus.set(k, set);
    } else {
      customNames.add(name);
    }
  }
  const sorted = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, sortLocale)).join(", ");
  const aiCount = schedules.filter((s) => s.source === "ai").length;
  const empty = schedules.length === 0;

  return (
    <Card
      elevation={0}
      onClick={() => onPick(iso)}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        cursor: "pointer",
        borderRadius: 2,
        border: "1px solid",
        borderColor: isToday ? "primary.main" : "divider",
        boxShadow: isToday ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}` : "none",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: 64,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 1,
          bgcolor: isToday ? "primary.main" : alpha(theme.palette.text.primary, 0.05),
          color: isToday ? "primary.contrastText" : "text.primary",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1, textAlign: "center" }}>
          {weekdayLong}
        </Typography>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.1 }}>{dayNum}</Typography>
        <Typography variant="caption" sx={{ lineHeight: 1, opacity: 0.85 }}>
          {monthShort}
        </Typography>
      </Box>

      <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0, p: 1 }}>
        {empty ? (
          <Typography variant="body2" color="text.secondary">
            {t("calendarAgendaNoSchedules")}
          </Typography>
        ) : (
          <>
            {STATUS_ORDER.filter((k) => namesByStatus.has(k)).map((k) => {
              const meta = statusMeta[k];
              const set = namesByStatus.get(k)!;
              return (
                <Stack key={k} direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
                  <Chip
                    size="small"
                    icon={<meta.Icon sx={{ fontSize: 15 }} />}
                    label={`${t(meta.i18nKey)} ${set.size}`}
                    sx={{
                      flexShrink: 0,
                      height: 22,
                      fontWeight: 800,
                      bgcolor: alpha(meta.color, 0.14),
                      color: meta.color,
                      "& .MuiChip-icon": { color: meta.color },
                    }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.45 }}>
                    {sorted(set)}
                  </Typography>
                </Stack>
              );
            })}
            {customNames.size > 0 && (
              <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Chip
                  size="small"
                  icon={<Diversity3Icon sx={{ fontSize: 15 }} />}
                  label={customNames.size}
                  sx={{
                    flexShrink: 0,
                    height: 22,
                    fontWeight: 800,
                    bgcolor: alpha(CUSTOM_SCHEDULE_STATUS_UI_COLOR, 0.14),
                    color: CUSTOM_SCHEDULE_STATUS_UI_COLOR,
                    "& .MuiChip-icon": { color: CUSTOM_SCHEDULE_STATUS_UI_COLOR },
                  }}
                />
                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.45 }}>
                  {sorted(customNames)}
                </Typography>
              </Stack>
            )}
          </>
        )}

        {(leaderOfficeMissing || birthdayNames.length > 0 || parkingCount > 0 || meetingCount > 0 || aiCount > 0) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center" sx={{ pt: 0.25 }}>
            {leaderOfficeMissing && (
              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: "error.main" }}>
                <SupervisorAccountIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={700}>
                  {t("calendarDayNoManagerOffice")}
                </Typography>
              </Stack>
            )}
            {birthdayNames.length > 0 && (
              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: "#c2185b" }}>
                <CakeOutlinedIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={700}>
                  {birthdayNames.join(", ")}
                </Typography>
              </Stack>
            )}
            {parkingCount > 0 && (
              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: "#0d47a1" }}>
                <LocalParkingIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={700}>
                  {parkingCount}
                </Typography>
              </Stack>
            )}
            {meetingCount > 0 && (
              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: "#004d40" }}>
                <MeetingRoomIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" fontWeight={700}>
                  {meetingCount}
                </Typography>
              </Stack>
            )}
            {aiCount > 0 && <AutoAwesomeIcon sx={{ fontSize: 16, color: "secondary.main" }} />}
          </Stack>
        )}
      </Stack>

      <Box sx={{ display: "flex", alignItems: "center", px: 0.25, color: "text.disabled" }}>
        {rtl ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </Box>
    </Card>
  );
}
