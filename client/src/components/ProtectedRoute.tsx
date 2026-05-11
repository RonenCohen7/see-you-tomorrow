import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../store/authContext";
import { Box, CircularProgress } from "@mui/material";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
