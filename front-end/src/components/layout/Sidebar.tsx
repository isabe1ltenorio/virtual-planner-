import type { FC } from "react";
import { NavLink } from "react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Bell,
  CalendarDays,
  BarChart3,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "../Brand";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const primaryNav: NavItem[] = [
  { to: "/", label: "Resumo do dia", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tarefas", icon: CheckSquare },
  { to: "/goals", label: "Metas", icon: Target },
  { to: "/reminders", label: "Lembretes", icon: Bell },
  { to: "/planner", label: "Planejamento", icon: CalendarDays },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
];

const secondaryNav: NavItem[] = [
  { to: "/profile", label: "Perfil", icon: User },
  { to: "/settings", label: "Configurações", icon: Settings },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
      : "text-muted hover:bg-surface-2 hover:text-ink",
  ].join(" ");

export const Sidebar: FC = () => {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border-c bg-surface p-3">
      <div className="px-2 py-3">
        <Brand size={30} />
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1">
        {primaryNav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        <div className="my-3 border-t border-border-c" />

        {secondaryNav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
