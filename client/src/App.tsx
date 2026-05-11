import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./i18n";
import { buildTheme } from "./theme/theme";
import { ThemeModeProvider, useThemeMode } from "./theme/ThemeModeContext";
import { AuthProvider } from "./store/authContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import EmployeesPage from "./pages/EmployeesPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import LocationsPage from "./pages/LocationsPage";
import ParkingManagementPage from "./pages/ParkingManagementPage";
import ScheduleManagementPage from "./pages/ScheduleManagementPage";
import NotificationsPage from "./pages/NotificationsPage";
import AIRecommendationsPage from "./pages/AIRecommendationsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

const qc = new QueryClient();

function Themed({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = buildTheme(mode);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeModeProvider>
        <Themed>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route
                    path="/employees"
                    element={
                      <AdminRoute>
                        <EmployeesPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/departments"
                    element={
                      <AdminRoute>
                        <DepartmentsPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/locations"
                    element={
                      <AdminRoute>
                        <LocationsPage />
                      </AdminRoute>
                    }
                  />
                  <Route path="/schedules" element={<ScheduleManagementPage />} />
                  <Route path="/parking" element={<ParkingManagementPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/ai" element={<AIRecommendationsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </Themed>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
