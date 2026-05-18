import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import type { TFunction } from "i18next";
import { isBuiltinScheduleStatus } from "./scheduleStatusKinds";
import { statusMeta } from "./statusMeta";

/** Color for organizational custom statuses in grids (distinct from core five). */
export const CUSTOM_SCHEDULE_STATUS_UI_COLOR = "#7c3aed";

export type ScheduleOrgCustomDef = { id: string; labelHe: string; labelEn?: string };

export function resolveScheduleLabel(
  status: string,
  t: TFunction,
  customs: ScheduleOrgCustomDef[] | undefined,
  locale?: "he" | "en"
): string {
  if (isBuiltinScheduleStatus(status)) return t(status);
  if (!status.startsWith("custom:")) return status;
  const id = status.slice("custom:".length);
  const def = customs?.find((c) => c.id === id);
  if (!def) return status;
  if (locale === "en" && def.labelEn?.trim()) return def.labelEn.trim();
  return def.labelHe.trim() || status;
}

export type ScheduleChipPresentation = {
  key: string;
  color: string;
  Icon: ComponentType<SvgIconProps>;
  i18nKey: string;
  presenceI18nKey: string;
  label: string;
  stored: string;
};

export function scheduleStatusPresentation(
  status: string,
  t: TFunction,
  customs?: ScheduleOrgCustomDef[]
): ScheduleChipPresentation {
  if (isBuiltinScheduleStatus(status)) {
    const m = statusMeta[status];
    return {
      key: status,
      color: m.color,
      Icon: m.Icon,
      i18nKey: m.i18nKey,
      presenceI18nKey: m.presenceI18nKey,
      label: t(m.i18nKey),
      stored: status,
    };
  }
  return {
    key: "custom",
    color: CUSTOM_SCHEDULE_STATUS_UI_COLOR,
    Icon: Diversity3Icon,
    i18nKey: "__custom_schedule__",
    presenceI18nKey: "__custom_schedule__",
    label: resolveScheduleLabel(status, t, customs, "he"),
    stored: status,
  };
}
