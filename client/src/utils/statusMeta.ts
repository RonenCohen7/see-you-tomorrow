import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import HomeIcon from "@mui/icons-material/Home";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import SickIcon from "@mui/icons-material/Sick";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import { statusColors, type StatusKey } from "../theme/theme";

export type StatusMeta = {
  key: StatusKey;
  color: string;
  Icon: ComponentType<SvgIconProps>;
  i18nKey: string;
  presenceI18nKey: string;
};

export const STATUS_ORDER: StatusKey[] = ["office", "home", "vacation", "sick", "off"];

export const statusMeta: Record<StatusKey, StatusMeta> = {
  office: { key: "office", color: statusColors.office, Icon: BusinessCenterIcon, i18nKey: "office", presenceI18nKey: "atOffice" },
  home: { key: "home", color: statusColors.home, Icon: HomeIcon, i18nKey: "home", presenceI18nKey: "atHome" },
  vacation: { key: "vacation", color: statusColors.vacation, Icon: BeachAccessIcon, i18nKey: "vacation", presenceI18nKey: "onVacation" },
  sick: { key: "sick", color: statusColors.sick, Icon: SickIcon, i18nKey: "sick", presenceI18nKey: "onSick" },
  off: { key: "off", color: statusColors.off, Icon: EventBusyIcon, i18nKey: "off", presenceI18nKey: "onOff" },
};
