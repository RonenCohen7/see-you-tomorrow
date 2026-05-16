import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { AppLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";

export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  return (
    <Tooltip title={t("languageToggleAria")}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={locale}
        aria-label={t("languageToggleAria")}
        onChange={(_e, next: AppLocale | null) => {
          if (next) setLocale(next);
        }}
        sx={{
          bgcolor: "rgba(255,255,255,0.14)",
          "& .MuiToggleButton-root": {
            color: "rgba(255,255,255,0.92)",
            px: 1,
            py: 0.25,
            fontWeight: 700,
            fontSize: "0.75rem",
            borderColor: "rgba(255,255,255,0.35)!important",
          },
          "& .Mui-selected": {
            bgcolor: "rgba(255,255,255,0.95)!important",
            color: "primary.dark",
          },
        }}
      >
        <ToggleButton value="en" aria-label={t("languageEnglish")}>
          EN
        </ToggleButton>
        <ToggleButton value="he" aria-label={t("languageHebrew")}>
          עב
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}
