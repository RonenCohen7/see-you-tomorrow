import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./i18n";
import { LocaleProvider, useLocale } from "./locale/LocaleContext";
import { localeDirection } from "./locale/localeConstants";
import { buildTheme } from "./theme/theme";
import { ThemeModeProvider, useThemeMode } from "./theme/ThemeModeContext";
import { AuthProvider } from "./store/authContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import ManagerOrAdminRoute from "./components/ManagerOrAdminRoute";
import MainLayout from "./layouts/MainLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import PricingPage from "./pages/PricingPage";
import LoginPage from "./pages/LoginPage";
import LoginCallbackPage from "./pages/LoginCallbackPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SupportPage from "./pages/SupportPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import CalendarFullMonthPage from "./pages/CalendarFullMonthPage";
import EmployeesPage from "./pages/EmployeesPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import LocationsPage from "./pages/LocationsPage";
import ParkingManagementPage from "./pages/ParkingManagementPage";
import ScheduleManagementPage from "./pages/ScheduleManagementPage";
import NotificationsPage from "./pages/NotificationsPage";
import AIRecommendationsPage from "./pages/AIRecommendationsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import SchedulingRulesPage from "./pages/SchedulingRulesPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeeRoute from "./components/EmployeeRoute";
import AttendancePreferencesPage from "./pages/AttendancePreferencesPage";
import TeamAttendancePreferencesPage from "./pages/TeamAttendancePreferencesPage";
import PreferenceAiQueuePage from "./pages/PreferenceAiQueuePage";
import MeetingRoomsPage from "./pages/MeetingRoomsPage";

const qc = new QueryClient();

function Themed({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const { locale } = useLocale();
  const theme = buildTheme(mode, localeDirection(locale));
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
        <LocaleProvider>
          <Themed>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/login/callback" element={<LoginCallbackPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route
                    path="/dashboard"
                    element={
                      <ManagerOrAdminRoute>
                        <DashboardPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/calendar/month/:ym" element={<CalendarFullMonthPage />} />
                  <Route path="/meeting-rooms" element={<MeetingRoomsPage />} />
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
                  <Route
                    path="/scheduling-rules"
                    element={
                      <AdminRoute>
                        <SchedulingRulesPage />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/schedules"
                    element={
                      <ManagerOrAdminRoute>
                        <ScheduleManagementPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/team-preferences"
                    element={
                      <ManagerOrAdminRoute>
                        <TeamAttendancePreferencesPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/preference-ai-queue"
                    element={
                      <ManagerOrAdminRoute>
                        <PreferenceAiQueuePage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/parking"
                    element={
                      <ManagerOrAdminRoute>
                        <ParkingManagementPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ManagerOrAdminRoute>
                        <ReportsPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ManagerOrAdminRoute>
                        <NotificationsPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route
                    path="/ai"
                    element={
                      <ManagerOrAdminRoute>
                        <AIRecommendationsPage />
                      </ManagerOrAdminRoute>
                    }
                  />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route
                    path="/preferences"
                    element={
                      <EmployeeRoute>
                        <AttendancePreferencesPage />
                      </EmployeeRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
          </Themed>
        </LocaleProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  );
}
