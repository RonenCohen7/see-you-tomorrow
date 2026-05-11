import type { TFunction } from "i18next";
import EventIcon from "@mui/icons-material/Event";
import type { SmartAlert } from "./aiSmartAlerts";

/** Gregorian windows — extend yearly. `chagFirst` = first day of observance impact for office. */
const HOLIDAY_PLANNING_WINDOWS: {
  id: string;
  remindFrom: string;
  chagFirst: string;
  chagLast: string;
  nameKey: string;
}[] = [
  { id: "shavuot-2026", remindFrom: "2026-05-18", chagFirst: "2026-06-01", chagLast: "2026-06-02", nameKey: "aiHolidayNameShavuot" },
  { id: "rosh-hashana-2026", remindFrom: "2026-09-19", chagFirst: "2026-10-03", chagLast: "2026-10-04", nameKey: "aiHolidayNameRoshHashana" },
  { id: "yom-kippur-2026", remindFrom: "2026-09-28", chagFirst: "2026-10-12", chagLast: "2026-10-12", nameKey: "aiHolidayNameYomKippur" },
  { id: "sukkot-2026", remindFrom: "2026-10-03", chagFirst: "2026-10-17", chagLast: "2026-10-24", nameKey: "aiHolidayNameSukkot" },
  { id: "purim-2027", remindFrom: "2027-02-28", chagFirst: "2027-03-14", chagLast: "2027-03-15", nameKey: "aiHolidayNamePurim" },
  { id: "pesach-2027", remindFrom: "2027-03-27", chagFirst: "2027-04-10", chagLast: "2027-04-18", nameKey: "aiHolidayNamePesach" },
];

function daysBetweenIso(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 864e5);
}

/** Upcoming / in-window Jewish-holiday planning hints for schedules & parking. */
export function buildJewishHolidayAlerts(todayIso: string, t: TFunction): SmartAlert[] {
  const out: SmartAlert[] = [];
  for (const h of HOLIDAY_PLANNING_WINDOWS) {
    if (todayIso < h.remindFrom || todayIso > h.chagLast) continue;
    const name = t(h.nameKey);
    const detail =
      todayIso < h.chagFirst
        ? t("aiHolidaySuggestBefore", { name, days: daysBetweenIso(todayIso, h.chagFirst), last: h.chagLast })
        : t("aiHolidaySuggestDuring", { name, last: h.chagLast });
    out.push({
      id: `holiday-${h.id}`,
      severity: "info",
      employeeId: "system",
      employeeName: t("aiHolidayContextLabel"),
      title: name,
      detail,
      Icon: EventIcon,
      color: "#6d28d9",
    });
  }
  return out;
}
