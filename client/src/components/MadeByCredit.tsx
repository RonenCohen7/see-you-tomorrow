import { Link, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { useTranslation } from "react-i18next";

export const AUTHOR_SITE_URL = "https://ronencohen.dev";

export function MadeByCredit({ sx }: { sx?: SxProps<Theme> }) {
  const { t } = useTranslation();
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", ...sx }}>
      {t("madeByPrefix")}{" "}
      <Link
        href={AUTHOR_SITE_URL}
        target="_blank"
        rel="noopener"
        underline="hover"
        sx={{ fontWeight: 700, direction: "ltr", unicodeBidi: "isolate" }}
      >
        Ronen Cohen · ronencohen.dev
      </Link>
    </Typography>
  );
}
