import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  SUPPORT_FAQ_CATEGORIES,
  SUPPORT_FAQ_ENTRIES,
  getFaqAnswer,
  getFaqQuestion,
  getQuickPickEntries,
  type SupportFaqCategory,
  type SupportFaqEntry,
  type SupportLocale,
} from "../../help/supportFaqBank";

const CATEGORY_LABEL_KEY: Record<SupportFaqCategory, string> = {
  login: "supportCategoryLogin",
  password: "supportCategoryPassword",
  registration: "supportCategoryRegistration",
  account: "supportCategoryAccount",
  access: "supportCategoryAccess",
  technical: "supportCategoryTechnical",
};

type Props = {
  onQuickPick?: (entry: SupportFaqEntry) => void;
  expandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
};

export function SupportFaqSection({ onQuickPick, expandedId, onExpandedChange }: Props) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === "en" ? "en" : "he") as SupportLocale;
  const [search, setSearch] = useState("");
  const [localExpanded, setLocalExpanded] = useState<string | false>(false);

  const expanded = expandedId ?? (localExpanded || false);
  const setExpanded = (id: string | false) => {
    onExpandedChange?.(id === false ? null : id);
    if (!onExpandedChange) setLocalExpanded(id);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SUPPORT_FAQ_ENTRIES;
    return SUPPORT_FAQ_ENTRIES.filter((e) => {
      const hay = [
        getFaqQuestion(e, locale),
        getFaqAnswer(e, locale),
        ...e.keywords,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [search, locale]);

  const byCategory = useMemo(() => {
    const map = new Map<SupportFaqCategory, SupportFaqEntry[]>();
    for (const cat of SUPPORT_FAQ_CATEGORIES) map.set(cat, []);
    for (const e of filtered) map.get(e.category)?.push(e);
    return map;
  }, [filtered]);

  const quickPicks = getQuickPickEntries();

  return (
    <Stack spacing={2}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        {t("supportFaqTitle")}
      </Typography>

      <TextField
        fullWidth
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("supportFaqSearchPlaceholder")}
      />

      {quickPicks.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t("supportQuickPickLabel")}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {quickPicks.map((e) => (
              <Chip
                key={e.id}
                label={getFaqQuestion(e, locale)}
                size="small"
                clickable
                onClick={() => {
                  setExpanded(e.id);
                  onQuickPick?.(e);
                }}
                sx={(th) => ({
                  maxWidth: "100%",
                  height: "auto",
                  "& .MuiChip-label": { whiteSpace: "normal", py: 0.75 },
                  bgcolor: alpha(th.palette.primary.main, 0.08),
                })}
              />
            ))}
          </Stack>
        </Box>
      )}

      {filtered.length === 0 ? (
        <Typography color="text.secondary">{t("supportFaqNoResults")}</Typography>
      ) : (
        SUPPORT_FAQ_CATEGORIES.map((cat) => {
          const items = byCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <Box key={cat}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, mt: 1 }}>
                {t(CATEGORY_LABEL_KEY[cat])}
              </Typography>
              {items.map((e) => (
                <Accordion
                  key={e.id}
                  expanded={expanded === e.id}
                  onChange={(_, isExp) => setExpanded(isExp ? e.id : false)}
                  disableGutters
                  sx={{ "&:before": { display: "none" }, mb: 0.5 }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{getFaqQuestion(e, locale)}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, mb: e.actionLink ? 1.5 : 0 }}>
                      {getFaqAnswer(e, locale)}
                    </Typography>
                    {e.actionLink && (
                      <Button component={RouterLink} to={e.actionLink} size="small" variant="outlined">
                        {t("supportActionGoTo")}
                      </Button>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          );
        })
      )}
    </Stack>
  );
}
