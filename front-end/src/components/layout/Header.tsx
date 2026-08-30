import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { Plus, Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { NotificationToggle } from "../NotificationToggle";

type ThemeMode = "light" | "dark" | "system";

interface HeaderProps {
  currentTab: string;
  onQuickCreate: () => void;
  theme: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Resumo do dia",
  "": "Resumo do dia",
  tasks: "Tarefas",
  goals: "Metas",
  reminders: "Lembretes",
  planner: "Planejamento",
  reports: "Relatórios",
  profile: "Perfil",
  settings: "Configurações",
};

const THEME_META: Record<
  ThemeMode,
  { label: string; icon: typeof Sun }
> = {
  light: { label: "Claro", icon: Sun },
  dark: { label: "Escuro", icon: Moon },
  system: { label: "Sistema", icon: Monitor },
};

export const Header: FC<HeaderProps> = ({
  currentTab,
  onQuickCreate,
  theme,
  onThemeChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const ActiveIcon = THEME_META[theme].icon;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-c bg-surface px-6">
      <h2 className="text-sm font-semibold text-ink">
        {PAGE_TITLES[currentTab] ?? "Taskly"}
      </h2>

      <div className="flex items-center gap-2">
        <NotificationToggle />

        {onThemeChange && (
          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="btn btn-outline"
            >
              <ActiveIcon size={16} strokeWidth={2} />
              <span className="hidden sm:inline">{THEME_META[theme].label}</span>
              <ChevronDown size={14} strokeWidth={2} />
            </button>

            {open && (
              <div className="card absolute right-0 z-50 mt-2 w-40 p-1 shadow-md">
                {(["light", "dark", "system"] as ThemeMode[]).map((mode) => {
                  const { label, icon: Icon } = THEME_META[mode];
                  const active = theme === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        onThemeChange(mode);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300"
                          : "text-muted hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <Icon size={16} strokeWidth={2} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onQuickCreate}
          className="btn btn-primary"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline">Nova tarefa</span>
        </button>
      </div>
    </header>
  );
};
