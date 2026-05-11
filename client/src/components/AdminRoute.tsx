import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
