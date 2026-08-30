import type { FC, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

type ThemeMode = "light" | "dark" | "system";

interface AppShellProps {
  children?: ReactNode;
  currentTab: string;
  onQuickCreate: () => void;
  theme: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

export const AppShell: FC<AppShellProps> = ({
  children,
  currentTab,
  onQuickCreate,
  theme,
  onThemeChange,
}) => {
  const activeTab = currentTab ? currentTab.split("/")[0] : "dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-ink">
      <Sidebar />

      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <Header
          currentTab={activeTab}
          onQuickCreate={onQuickCreate}
          theme={theme}
          onThemeChange={onThemeChange}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
