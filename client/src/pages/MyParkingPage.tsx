import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ParkingClaimPanel } from "../components/ParkingClaimPanel";

export default function MyParkingPage() {
  const { t } = useTranslation();
  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("myParkingTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("myParkingSubtitle")}
      </Typography>
      <ParkingClaimPanel />
    </Box>
  );
}
