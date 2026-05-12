import { Box, Stack, Tooltip, Typography, alpha, useTheme } from "@mui/material";
import CakeOutlinedIcon from "@mui/icons-material/CakeOutlined";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import type { TFunction } from "i18next";
import { STATUS_ORDER, statusMeta } from "../utils/statusMeta";
import type { StatusKey } from "../theme/theme";
import type { DayAgg } from "./calendarConstants";

export type MonthDayCellModel = { iso: string; agg?: DayAgg };

export function MonthDayCell({
  cell,
  today,
  leaderOfficeMissing,
  leaderNamesToday,
  birthdaysByIso,
  parkingByIso,
  statusInlineMax,
  t,
  onPickDay,
  compact,
}: {
  cell: MonthDayCellModel;
  today: string;
  leaderOfficeMissing: boolean;
  leaderNamesToday: string[];
  birthdaysByIso: Map<string, { employeeId: string; fullName: string }[]>;
  parkingByIso: Map<string, { spotLabel: string; guestName: string; hoursLabel: string }[]>;
  statusInlineMax: number;
  t: TFunction;
  onPickDay: (iso: string) => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const isToday = cell.iso === today;
  const dayNum = Number(cell.iso.slice(8));
  const totals: { k: StatusKey; n: number }[] = STATUS_ORDER.map((k) => ({
    k,
    n: cell.agg ? (cell.agg[k] as number) : 0,
  })).filter((x) => x.n > 0);
  const monthTotalsVisible = totals.slice(0, statusInlineMax);
  const monthTotalsHidden = totals.slice(statusInlineMax);
  const mbdays = birthdaysByIso.get(cell.iso) ?? [];
  const pkdays = parkingByIso.get(cell.iso) ?? [];
  const accentBirthday = mbdays.length > 0;
  const accentParking = pkdays.length > 0 && !accentBirthday;

  const aiAssignments = cell.agg?.aiAssignments ?? 0;
  const pad = compact ? { xs: 0.35, sm: 0.5 } : { xs: 0.3, sm: 0.65 };
  const minH = compact ? { xs: 76, sm: 92 } : { xs: 54, sm: 86 };
  const radius = compact ? { xs: 0.5, sm: 1 } : { xs: 0.75, sm: 1.5 };

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        onPickDay(cell.iso);
      }}
      sx={{
        cursor: "pointer",
        borderRadius: radius,
        p: pad,
        minHeight: minH,
        minWidth: 0,
        boxSizing: "border-box",
        overflow: "visible",
        pb: compact ? { xs: 0.75, sm: 0.85 } : undefined,
        border: "1px solid",
        borderColor: leaderOfficeMissing
          ? alpha(theme.palette.error.main, 0.5)
          : isToday
            ? "primary.main"
            : accentBirthday
              ? alpha("#e91e63", 0.45)
              : accentParking
                ? alpha("#1565c0", 0.45)
                : "divider",
        backgroundColor: leaderOfficeMissing
          ? alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.07 : 0.05)
          : isToday
            ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.08)
            : accentBirthday
              ? alpha("#f48fb1", theme.palette.mode === "dark" ? 0.1 : 0.06)
              : accentParking
                ? alpha("#90caf9", theme.palette.mode === "dark" ? 0.1 : 0.06)
                : "transparent",
        boxShadow:
          isToday && !leaderOfficeMissing
            ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`
            : "none",
        transition: "box-shadow 160ms, border-color 160ms",
        "&:hover": {
          boxShadow: 2,
          borderColor: "primary.light",
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.25}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: isToday ? 800 : 600,
            color: isToday ? "primary.main" : "text.primary",
            fontSize: compact ? { xs: "0.72rem", sm: "0.78rem" } : { xs: "0.78rem", sm: "0.85rem" },
          }}
        >
          {dayNum}
        </Typography>
        <Stack direction="row" spacing={0.25} alignItems="center">
          {mbdays.length > 0 && (
            <Tooltip title={mbdays.map((b) => b.fullName).join(" · ")} arrow>
              <CakeOutlinedIcon sx={{ fontSize: compact ? 14 : { xs: 16, sm: 18 }, color: "#c2185b" }} />
            </Tooltip>
          )}
          {pkdays.length > 0 && (
            <Tooltip
              title={pkdays.map((p) => `${p.spotLabel}: ${p.guestName} (${p.hoursLabel})`).join("\n")}
              arrow
            >
              <LocalParkingIcon sx={{ fontSize: compact ? 14 : { xs: 16, sm: 18 }, color: "#0d47a1" }} />
            </Tooltip>
          )}
          {aiAssignments > 0 && (
            <Tooltip title={t("calendarAiDayHint", { count: aiAssignments })} arrow>
              <AutoAwesomeIcon
                sx={{
                  fontSize: compact ? 14 : { xs: 16, sm: 18 },
                  color: theme.palette.secondary.main,
                }}
              />
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, gap: 0.25 }}>
        {totals.length === 0 ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontSize: compact ? "0.65rem" : { xs: "0.75rem", sm: "0.8125rem" } }}
          >
            —
          </Typography>
        ) : (
          <>
            {monthTotalsVisible.map(({ k, n }) => {
              const meta = statusMeta[k];
              return (
                <Tooltip key={k} title={`${t(meta.presenceI18nKey)}: ${n}`} arrow>
                  <Stack
                    direction="row"
                    spacing={0.25}
                    alignItems="center"
                    sx={{
                      px: { xs: 0.25, sm: 0.4 },
                      py: 0.125,
                      borderRadius: 1,
                      bgcolor: alpha(meta.color, 0.14),
                      color: meta.color,
                      fontSize: compact ? 9 : { xs: 10, sm: 12 },
                      fontWeight: 700,
                      maxWidth: "100%",
                    }}
                  >
                    <meta.Icon sx={{ fontSize: compact ? 11 : { xs: 12, sm: 14 } }} />
                    <span>{n}</span>
                  </Stack>
                </Tooltip>
              );
            })}
            {monthTotalsHidden.length > 0 ? (
              <Tooltip
                arrow
                title={monthTotalsHidden.map(({ k, n }) => `${t(statusMeta[k].presenceI18nKey)}: ${n}`).join(" · ")}
              >
                <Stack
                  direction="row"
                  spacing={0.25}
                  alignItems="center"
                  sx={{
                    px: { xs: 0.25, sm: 0.4 },
                    py: 0.125,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.text.secondary, 0.12),
                    color: "text.secondary",
                    fontSize: compact ? 9 : { xs: 10, sm: 12 },
                    fontWeight: 800,
                    cursor: "default",
                  }}
                >
                  <span>{t("calendarMoreStatuses", { count: monthTotalsHidden.length })}</span>
                </Stack>
              </Tooltip>
            ) : null}
          </>
        )}
      </Stack>
      {mbdays.length > 0 && (
        <Typography
          variant="caption"
          noWrap={!compact}
          sx={{
            display: "block",
            mt: 0.35,
            fontSize: compact ? "0.62rem" : { xs: "0.6875rem", sm: "0.75rem" },
            fontWeight: 700,
            color: "#ad1457",
            ...(compact ? { whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25 } : {}),
          }}
        >
          {mbdays.length === 1 ? mbdays[0].fullName : `🎈 ${mbdays.length}`}
        </Typography>
      )}
      {pkdays.length > 0 && (
        <Typography
          variant="caption"
          noWrap={!compact}
          sx={{
            display: "block",
            mt: 0.25,
            fontSize: compact ? "0.62rem" : { xs: "0.6875rem", sm: "0.75rem" },
            fontWeight: 700,
            color: "#0d47a1",
            ...(compact ? { whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25 } : {}),
          }}
        >
          {pkdays.length === 1 ? `${pkdays[0].spotLabel} → ${pkdays[0].guestName}` : `🅿 ${pkdays.length}`}
        </Typography>
      )}
      {leaderOfficeMissing ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            fontSize: compact ? "0.52rem" : { xs: "0.58rem", sm: "0.62rem" },
            fontWeight: 700,
            color: "error.light",
            lineHeight: compact ? 1.25 : 1.15,
            whiteSpace: "normal",
            wordBreak: "break-word",
            ...(compact ? { pb: 0.25 } : {}),
          }}
        >
          {t("calendarDayNoManagerOffice")}
        </Typography>
      ) : leaderNamesToday.length > 0 ? (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            fontSize: compact ? "0.52rem" : { xs: "0.58rem", sm: "0.62rem" },
            fontWeight: 600,
            color: "success.light",
            lineHeight: compact ? 1.25 : 1.15,
            whiteSpace: "normal",
            wordBreak: "break-word",
            ...(compact ? { pb: 0.25 } : {}),
          }}
        >
          {t("calendarManagersInOffice", { names: leaderNamesToday.join(" · ") })}
        </Typography>
      ) : null}
    </Box>
  );
}
