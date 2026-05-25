import { alpha, Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import { MutedBackdropVideo } from "../components/MutedBackdropVideo";
import { SupportAiChat } from "../components/support/SupportAiChat";
import { SupportFaqSection } from "../components/support/SupportFaqSection";
import type { SupportFaqEntry } from "../help/supportFaqBank";

export default function SupportPage() {
  const { t } = useTranslation();
  const [seedEntry, setSeedEntry] = useState<SupportFaqEntry | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        isolation: "isolate",
        bgcolor: "background.default",
      }}
    >
      <MutedBackdropVideo />
      <Box sx={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <PublicHeader />
        <Box sx={{ py: { xs: 3, md: 5 }, flex: 1 }}>
          <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, pb: `max(24px, env(safe-area-inset-bottom, 0px))` }}>
            <Stack spacing={3}>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: "1.5rem", sm: "2rem" },
                  textAlign: { xs: "center", sm: "start" },
                }}
              >
                {t("supportPageTitle")}
              </Typography>

              <Card
                variant="outlined"
                sx={(th) => ({
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.88 : 0.94),
                  backdropFilter: "saturate(140%) blur(10px)",
                })}
              >
                <CardContent>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {t("supportPageIntro")}
                  </Typography>
                </CardContent>
              </Card>

              <Card
                variant="outlined"
                sx={(th) => ({
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.82 : 0.9),
                  backdropFilter: "blur(10px)",
                })}
              >
                <CardContent>
                  <SupportFaqSection
                    expandedId={expandedId}
                    onExpandedChange={setExpandedId}
                    onQuickPick={(e) => {
                      setSeedEntry(e);
                      setExpandedId(e.id);
                    }}
                  />
                </CardContent>
              </Card>

              <SupportAiChat seedEntry={seedEntry} />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
                <Button component={RouterLink} to="/login" variant="outlined">
                  {t("login")}
                </Button>
                <Button component="a" href={t("pricingContactHref")} variant="text">
                  {t("supportContactSales")}
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
