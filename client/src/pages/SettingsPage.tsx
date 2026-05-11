import { Box, FormControlLabel, Switch, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../theme/ThemeModeContext";
import { useRole } from "../store/authContext";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { mode, toggle } = useThemeMode();
  const role = useRole();
  const qc = useQueryClient();

  const orgQ = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => (await api.get<{ managerCanEditSchedules: boolean }>("/api/schedules/org-settings")).data,
    enabled: role === "admin",
  });

  const patchOrg = useMutation({
    mutationFn: async (v: boolean) => api.patch("/api/schedules/org-settings", { managerCanEditSchedules: v }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["org-settings"] }),
  });

  return (
    <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: "1.35rem", sm: "2.125rem" } }}>
        {t("settings")}
      </Typography>
      <FormControlLabel
        sx={{ alignItems: "flex-start", mr: 0, "& .MuiFormControlLabel-label": { whiteSpace: "normal" } }}
        control={<Switch checked={mode === "dark"} onChange={toggle} />}
        label={t("darkMode")}
      />

      {role === "admin" && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            ארגון
          </Typography>
          <FormControlLabel
            sx={{ alignItems: "flex-start", mr: 0, "& .MuiFormControlLabel-label": { whiteSpace: "normal" } }}
            control={
              <Switch
                checked={!!orgQ.data?.managerCanEditSchedules}
                onChange={(_, v) => patchOrg.mutate(v)}
                disabled={orgQ.isLoading || patchOrg.isPending}
              />
            }
            label="מנהלים רשאים לערוך משמרות"
          />
        </Box>
      )}
    </Box>
  );
}
