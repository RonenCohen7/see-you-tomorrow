import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useAuth } from "../store/authContext";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type DepartmentOption = { id: string; name: string; isActive?: boolean };

/** Employees and managers without a department must pick one before scheduling can include them. */
export function DepartmentSelfAssignDialog() {
  const { t } = useTranslation();
  const { user, refreshMe } = useAuth();
  const qc = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const open = Boolean(user && user.role !== "admin" && !user.departmentId);

  const deptQ = useQuery({
    queryKey: ["departments-self-assign"],
    queryFn: async () => (await api.get<{ items: DepartmentOption[] }>("/api/departments")).data.items,
    enabled: open,
  });
  const departments = (deptQ.data ?? []).filter((d) => d.isActive !== false);

  const assignMut = useMutation({
    mutationFn: async () => {
      await api.put("/api/employees/me/department", { departmentId });
    },
    onSuccess: async () => {
      await refreshMe();
      await qc.invalidateQueries({ queryKey: ["pref-pipeline"] });
      await qc.invalidateQueries({ queryKey: ["attendance-pref"] });
    },
  });

  if (!open) return null;
  if (deptQ.isSuccess && departments.length === 0) return null;

  return (
    <Dialog open disableEscapeKeyDown maxWidth="xs" fullWidth>
      <DialogTitle>{t("selfAssignDeptTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("selfAssignDeptBody")}
        </Typography>
        {assignMut.isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {apiErrorMessage(assignMut.error, t("error"))}
          </Alert>
        ) : null}
        <TextField
          select
          fullWidth
          required
          label={t("registerDepartment")}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={deptQ.isLoading}
          helperText={deptQ.isLoading ? t("registerDepartmentsLoading") : undefined}
        >
          {departments.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" disabled={!departmentId || assignMut.isPending} onClick={() => assignMut.mutate()}>
          {assignMut.isPending ? t("loading") : t("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
