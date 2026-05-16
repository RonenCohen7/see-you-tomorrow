import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { alpha, Box, Button, Card, CardContent, Container, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import { MutedBackdropVideo } from "../components/MutedBackdropVideo";

const BENEFIT_KEYS = [
  { titleKey: "aboutBenefit1Title", bodyKey: "aboutBenefit1Body" },
  { titleKey: "aboutBenefit2Title", bodyKey: "aboutBenefit2Body" },
  { titleKey: "aboutBenefit3Title", bodyKey: "aboutBenefit3Body" },
  { titleKey: "aboutBenefit4Title", bodyKey: "aboutBenefit4Body" },
  { titleKey: "aboutBenefit5Title", bodyKey: "aboutBenefit5Body" },
] as const;

export default function AboutPage() {
  const { t } = useTranslation();

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
                {t("aboutPageTitle")}
              </Typography>

              <Card
                variant="outlined"
                sx={(th) => ({
                  bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.88 : 0.94),
                  backdropFilter: "saturate(140%) blur(10px)",
                  WebkitBackdropFilter: "saturate(140%) blur(10px)",
                })}
              >
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                    {t("aboutVisionTitle")}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                    {t("aboutVisionBody")}
                  </Typography>
                </CardContent>
              </Card>

              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {t("aboutBenefitsTitle")}
              </Typography>

              <Stack spacing={2}>
                {BENEFIT_KEYS.map(({ titleKey, bodyKey }) => (
                  <Card
                    key={titleKey}
                    variant="outlined"
                    sx={(th) => ({
                      bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.82 : 0.9),
                      backdropFilter: "blur(10px)",
                    })}
                  >
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <InfoOutlinedIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
                        <Box>
                          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                            {t(titleKey)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {t(bodyKey)}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ pt: 1 }}>
                <Button component={RouterLink} to="/register" variant="contained" size="large">
                  {t("aboutCtaRegister")}
                </Button>
                <Button component={RouterLink} to="/pricing" variant="outlined" size="large">
                  {t("aboutCtaPricing")}
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
