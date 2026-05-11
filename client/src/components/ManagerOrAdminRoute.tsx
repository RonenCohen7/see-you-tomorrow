import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "../store/authContext";

export default function ManagerOrAdminRoute({ children }: { children: ReactNode }) {
  const role = useRole();
  if (role !== "admin" && role !== "manager") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
