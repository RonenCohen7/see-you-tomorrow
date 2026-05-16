import { Alert, Button, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Employee, Schedule } from "../types/models";
import { appIntlLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";
import { findManagerOfficeCoverageGaps } from "../utils/aiSmartAlerts";
import { utcWeekdayShort } from "../utils/israeliWeek";

type Props = {
  employees: Employee[];
  schedules: Schedule[];
  weekDays: string[];
  /** When false, do not show (e.g. while employees list is still loading). */
  ready: boolean;
};

export function ManagerOfficeCoverageBanner({ employees, schedules, weekDays, ready }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const intlTag = appIntlLocale(locale);
  if (!ready || employees.length === 0) return null;
  const gaps = findManagerOfficeCoverageGaps(employees, schedules, weekDays);
  if (gaps.length === 0) return null;
  const labels = gaps.map((d) => `${d} (${utcWeekdayShort(d, intlTag)})`).join(" · ");
  return (
    <Alert
      severity="error"
      sx={{
        mb: 2,
        minWidth: 0,
        maxWidth: "100%",
        "& .MuiAlert-message": { minWidth: 0, width: "100%", overflowWrap: "anywhere" },
      }}
    >
      <Stack spacing={1.25} alignItems="flex-start">
        <Typography variant="subtitle1" fontWeight={800} component="div">
          {t("aiManagerOfficeCoverageTitle")}
        </Typography>
        <Typography variant="body2" fontWeight={600} component="div" sx={{ color: "text.primary" }}>
          {t("aiManagerOfficeCoveragePolicyLead")}
        </Typography>
        <Typography variant="body2" component="div">
          {t("aiManagerOfficeCoverageDetail", { dates: labels })}
        </Typography>
        <Button size="small" variant="contained" color="inherit" component={RouterLink} to="/schedules">
          {t("managerOfficeCoverageGoSchedules")}
        </Button>
      </Stack>
    </Alert>
  );
}
