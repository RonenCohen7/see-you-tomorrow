import { Avatar, Box, Button, Card, CardContent, Typography } from "@mui/material";
import { useAuth } from "../store/authContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { t } = useTranslation();

  if (!user) return null;

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("profile")}
      </Typography>
      <Card sx={{ maxWidth: { xs: "100%", sm: 520 } }}>
        <CardContent
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            alignItems: { xs: "center", sm: "center" },
            textAlign: { xs: "center", sm: "start" },
          }}
        >
          <Avatar src={user.imageUrl} sx={{ width: 72, height: 72 }}>
            {user.fullName.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0, textAlign: { xs: "center", sm: "start" } }}>
            <Typography variant="h6" sx={{ wordBreak: "break-word" }}>
              {user.fullName}
            </Typography>
            <Typography color="text.secondary" sx={{ wordBreak: "break-all", overflowWrap: "anywhere" }}>
              {user.email}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
              {user.jobTitle}
            </Typography>
            <Typography variant="caption">{user.role}</Typography>
          </Box>
        </CardContent>
      </Card>
      <Button
        sx={{ mt: 2 }}
        variant="outlined"
        color="error"
        onClick={async () => {
          await logout();
          nav("/");
        }}
      >
        {t("logout")}
      </Button>
    </Box>
  );
}
