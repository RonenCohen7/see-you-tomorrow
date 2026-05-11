import { Box, Button, Card, CardContent, List, ListItem, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useTranslation } from "react-i18next";

interface N {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ items: N[] }>("/api/notifications")).data,
  });

  const readMut = useMutation({
    mutationFn: async (id: string) => api.put(`/api/notifications/${id}/read`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications"] });
      await qc.invalidateQueries({ queryKey: ["unread"] });
    },
  });

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("notifications")}
      </Typography>
      <List sx={{ width: "100%" }}>
        {(q.data?.items ?? []).map((n) => (
          <Card key={n.id} variant="outlined" sx={{ mb: 1 }}>
            <CardContent
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" sx={{ wordBreak: "break-word" }}>
                  {n.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word", mt: 0.25 }}>
                  {n.message}
                </Typography>
                <Typography variant="caption">{new Date(n.createdAt).toLocaleString("he-IL")}</Typography>
              </Box>
              <Button size="small" onClick={() => readMut.mutate(n.id)} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}>
                סמן כנקרא
              </Button>
            </CardContent>
          </Card>
        ))}
      </List>
    </Box>
  );
}
