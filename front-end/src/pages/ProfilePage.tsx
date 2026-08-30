import { useEffect, useState } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { currentUser } from "../lib/api/session";
import type { User } from "../types/domain";
import { Card, LoadingState, PageHeader, StatCard } from "../components/ui";

export function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({ tasks: 0, goals: 0, reminders: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [me, tasks, goals, reminders] = await Promise.all([
          currentUser(),
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getGoals(),
          virtualPlannerApi.getReminders(),
        ]);
        setUser(me);
        setStats({
          tasks: tasks.length,
          goals: goals.length,
          reminders: reminders.length,
        });
      } catch (error) {
        console.error("Erro ao carregar o perfil:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <LoadingState label="Carregando perfil…" />;

  const initial = user?.name?.trim().charAt(0).toUpperCase() || "U";

  return (
    <>
      <PageHeader title="Perfil" subtitle="Sua conta em números." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-3xl font-semibold text-white">
            {initial}
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">
              {user?.name || "Usuária"}
            </p>
            <p className="text-sm text-muted">{user?.email}</p>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-2">
          <StatCard label="Tarefas" value={stats.tasks} />
          <StatCard label="Metas" value={stats.goals} />
          <StatCard label="Lembretes" value={stats.reminders} />
        </div>
      </div>
    </>
  );
}
