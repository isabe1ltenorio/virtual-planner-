import type { FC } from "react";
import { Link, useLocation } from "react-router";

export const Sidebar: FC = () => {
  const location = useLocation();

  const navItems = [
    { id: "/profile", label: "Meu Perfil", icon: "👤" },
    { id: "/", label: "Dashboard", icon: "📊" },
    { id: "/tasks", label: "Tarefas", icon: "✅" },
    { id: "/goals", label: "Metas", icon: "🎯" },
    { id: "/reminders", label: "Lembretes", icon: "🔔" },
    { id: "/planner", label: "Planejamento Diário", icon: "📅" },
    { id: "/reports", label: "Relatórios", icon: "📈" },
    { id: "/settings", label: "Configurações", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 min-h-screen p-4 flex flex-col shrink-0 transition-colors duration-300">
      <div className="flex items-center gap-3 px-2 mb-6 mt-2">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-purple-600/30 text-white shrink-0">
          V
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight text-gray-900 dark:text-white">
            Virtual Planner
          </h1>
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            Painel Integrado
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.id;

          return (
            <Link
              key={item.id}
              to={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
