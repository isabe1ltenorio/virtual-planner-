import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router";
import { AppShell } from "./components/layout/AppShell";

import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { GoalsPage } from "./pages/GoalsPage";
import { GoalFormPage } from "./pages/GoalFormPage";
import { RemindersPage } from "./pages/RemindersPage";
import { ReminderFormPage } from "./pages/ReminderFormPage";
import { PlannerPage } from "./pages/PlannerPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { LoginPage } from "./pages/LoginPage";
import { RequireSession } from "./components/RequireSession";

type ThemeMode = "light" | "dark" | "system";

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>(
    () =>
      (localStorage.getItem("taskly:theme") as ThemeMode | null) ?? "system",
  );

  // Sincroniza o tema com o <html> e acompanha a preferência do sistema
  // enquanto o modo for "system".
  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark =
        theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
    };

    apply();
    localStorage.setItem("taskly:theme", theme);

    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  // Mapeia a URL atual para a aba ativa do AppShell
  const currentTab = location.pathname.split("/")[1] || "dashboard";

  const handleQuickCreate = () => {
    navigate("/tasks/new");
  };

  return (
    <AppShell
      currentTab={currentTab}
      theme={theme}
      onThemeChange={setTheme}
      onQuickCreate={handleQuickCreate}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />

        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/new" element={<TaskFormPage />} />
        <Route path="/tasks/:id/edit" element={<TaskFormPage />} />

        <Route path="/planner" element={<PlannerPage />} />

        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/goals/new" element={<GoalFormPage />} />
        <Route path="/goals/:id/edit" element={<GoalFormPage />} />

        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/reminders/new" element={<ReminderFormPage />} />
        <Route path="/reminders/:id/edit" element={<ReminderFormPage />} />

        <Route path="/reports" element={<ReportsPage />} />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fora do AppShell de proposito: a tela de login nao tem sidebar nem
            barra superior, e nao pode exigir sessao para ser vista. */}
        <Route path="/login" element={<LoginPage />} />

        {/* Todo o resto so renderiza com sessao valida. Sem o guarda, quem nao
            estivesse logado via o dashboard montado e vazio, com 401 no
            console e nenhuma explicacao na tela. */}
        <Route
          path="*"
          element={
            <RequireSession>
              <MainLayout />
            </RequireSession>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
