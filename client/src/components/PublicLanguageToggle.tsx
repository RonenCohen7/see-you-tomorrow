import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useTranslation } from "react-i18next";
import type { AppLocale } from "../locale/localeConstants";
import { useLocale } from "../locale/LocaleContext";

/** Same behavior as LanguageToggle, styled for light AppBar surfaces */
export default function PublicLanguageToggle() {
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
