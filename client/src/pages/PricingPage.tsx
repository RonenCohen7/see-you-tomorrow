import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { alpha, Box, Button, Card, CardActions, CardContent, Chip, Container, List, ListItem, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import { MutedBackdropVideo } from "../components/MutedBackdropVideo";

const TIERS: {
  kind: "starter" | "pro" | "enterprise";
  nameKey: string;
  priceKey: string;
  featureKeys: string[];
  highlighted: boolean;
}[] = [
  {
    kind: "starter",
    nameKey: "pricingTierStarterName",
    priceKey: "pricingTierStarterPrice",
    featureKeys: [
      "pricingTierStarterFeat1",
      "pricingTierStarterFeat2",
      "pricingTierStarterFeat3",
      "pricingTierStarterFeat4",
    ],
    highlighted: false,
  },
  {
    kind: "pro",
    nameKey: "pricingTierProName",
    priceKey: "pricingTierProPrice",
    featureKeys: [
      "pricingTierProFeat1",
      "pricingTierProFeat2",
      "pricingTierProFeat3",
      "pricingTierProFeat4",
      "pricingTierProFeat5",
    ],
    highlighted: true,
  },
  {
    kind: "enterprise",
    nameKey: "pricingTierEnterpriseName",
    priceKey: "pricingTierEnterprisePrice",
    featureKeys: [
      "pricingTierEnterpriseFeat1",
      "pricingTierEnterpriseFeat2",
      "pricingTierEnterpriseFeat3",
      "pricingTierEnterpriseFeat4",
    ],
    highlighted: false,
  },
];

export default function PricingPage() {
  const { t } = useTranslation();
  const contactHref = t("pricingContactHref");

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
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 }, pb: `max(24px, env(safe-area-inset-bottom, 0px))` }}>
            <Stack spacing={{ xs: 3, md: 4 }}>
              <Stack spacing={1} textAlign={{ xs: "center", md: "start" }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: "1.5rem", sm: "2rem" } }}>
                  {t("pricingPageTitle")}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mx: { xs: "auto", md: 0 } }}>
                  {t("pricingPageSubtitle")}
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                  alignItems: "stretch",
                }}
              >
                {TIERS.map((tier) => (
                  <Card
                    key={tier.kind}
                    variant="outlined"
                    sx={(theme) => ({
                      position: "relative",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.88 : 0.94),
                      backdropFilter: "blur(12px)",
                      ...(tier.highlighted
                        ? {
                            borderWidth: 2,
                            borderColor: "primary.main",
                            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}`,
                          }
                        : {}),
                    })}
                  >
                    {tier.highlighted ? (
                      <Chip
                        label={t("pricingPopularChip")}
                        color="primary"
                        size="small"
                        sx={{ position: "absolute", top: 12, insetInlineEnd: 12, fontWeight: 800 }}
                      />
                    ) : null}
                    <CardContent sx={{ flex: 1, pt: tier.highlighted ? 4 : 2 }}>
                      <Typography variant="h6" component="h2" sx={{ fontWeight: 800, mb: 0.75 }}>
                        {t(tier.nameKey)}
                      </Typography>
                      <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 800, mb: 2 }}>
                        {t(tier.priceKey)}
                      </Typography>
                      <List dense disablePadding>
                        {tier.featureKeys.map((fk) => (
                          <ListItem key={fk} disableGutters sx={{ alignItems: "flex-start", py: 0.35 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircleOutlineIcon fontSize="small" color="primary" />
                            </ListItemIcon>
                            <ListItemText primary={t(fk)} primaryTypographyProps={{ variant: "body2" }} />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0, flexShrink: 0 }}>
                      {tier.kind === "enterprise" ? (
                        <Button fullWidth variant="contained" color="inherit" component="a" href={contactHref} rel="noopener noreferrer">
                          {t("pricingCtaContact")}
                        </Button>
                      ) : (
                        <Button fullWidth variant={tier.highlighted ? "contained" : "outlined"} component={RouterLink} to="/register">
                          {t("pricingCtaStart")}
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 720, mx: { xs: "auto", md: 0 }, lineHeight: 1.55 }}>
                {t("pricingDisclaimer")}
              </Typography>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  );
}
