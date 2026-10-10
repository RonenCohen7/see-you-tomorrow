import CloseIcon from "@mui/icons-material/Close";
import { Alert, Dialog, DialogContent, IconButton } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../services/api";
import { useAuth } from "../store/authContext";

export type SystemBroadcastItem = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  at: string;
};

export default function SystemBroadcastDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pendingQ = useQuery({
    queryKey: ["system-broadcasts-pending"],
    queryFn: async () =>
      (await api.get<{ items: SystemBroadcastItem[] }>("/api/notifications/system-broadcasts/pending")).data.items,
    enabled: !!user,
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
  });

  const current = pendingQ.data?.[0];

  const dismiss = useMutation({
    mutationFn: async (id: string) => api.post(`/api/notifications/system-broadcasts/${id}/dismiss`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["system-broadcasts-pending"] });
    },
  });

  return (
    <Dialog
      open={!!current}
      onClose={(_event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="system-broadcast-title"
    >
      {current ? (
        <DialogContent sx={{ p: 0 }}>
          <Alert
            severity={current.severity}
            variant="filled"
            icon={false}
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(current.id)}
              >
                <CloseIcon />
              </IconButton>
            }
            sx={{
              alignItems: "flex-start",
              borderRadius: 1,
              py: 2.5,
              px: 2.5,
              "& .MuiAlert-message": { width: "100%" },
            }}
          >
            <span id="system-broadcast-title" style={{ fontWeight: 800, fontSize: "1.15rem", display: "block" }}>
              {current.title}
            </span>
            <span style={{ display: "block", marginTop: 8, whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: 1.55 }}>
              {current.message}
            </span>
          </Alert>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
