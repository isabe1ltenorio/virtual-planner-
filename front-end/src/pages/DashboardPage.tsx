import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, Clock, Target, Bell, Plus } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Task, Goal, Reminder } from "../types/domain";
import {
  formatDateForInput,
  formatMinutesToTime,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  REMINDER_TYPE_LABELS,
} from "../lib/formatters";
import {
  Badge,
  Card,
  LoadingState,
  PageHeader,
  StatCard,
} from "../components/ui";
import { buttonClass } from "../components/buttonStyles";

export function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = formatDateForInput();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [t, g, r] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getGoals(),
          virtualPlannerApi.getReminders(),
        ]);
        setTasks(t);
        setGoals(g);
        setReminders(r);
      } catch (error) {
        console.error("Erro ao carregar o resumo do dia:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const todayTasks = [...tasks]
    .filter((t) => t.date === today)
    .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));

  const inProgressGoals = goals.filter((g) => g.status === "In Progress");
  const todayReminders = reminders.filter((r) => r.date === today);

  const executed = todayTasks.filter((t) => t.status === "Executed").length;
  const partial = todayTasks.filter(
    (t) => t.status === "PartiallyExecuted",
  ).length;
  const pending = todayTasks.filter((t) => t.status === "Pending").length;

  // Mesma ideia do relatório do backend: parcial vale meio.
  const productivity =
    todayTasks.length > 0
      ? Math.round(((executed + partial * 0.5) / todayTasks.length) * 100)
      : 0;

  if (isLoading) return <LoadingState label="Carregando seu dia…" />;

  return (
    <>
      <PageHeader
        title="Resumo do dia"
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <Link to="/tasks/new" className={buttonClass("primary")}>
            <Plus size={16} strokeWidth={2.5} />
            Nova tarefa
          </Link>
        }
      />

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            Produtividade de hoje
          </span>
          <span className="stat-value text-lg font-semibold text-ink">
            {productivity}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
            style={{ width: `${productivity}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pendentes"
          value={pending}
          icon={<Clock size={16} />}
        />
        <StatCard
          label="Concluídas"
          value={executed}
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          label="Metas em andamento"
          value={inProgressGoals.length}
          icon={<Target size={16} />}
        />
        <StatCard
          label="Lembretes hoje"
          value={todayReminders.length}
          icon={<Bell size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink">
            Tarefas de hoje
          </h2>
          {todayTasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-subtle">
              Nada agendado para hoje.
            </p>
          ) : (
            <ul className="divide-y divide-border-c">
              {todayTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: CATEGORY_COLORS[task.category] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {task.description}
                    </p>
                    <p className="text-xs text-muted">
                      {CATEGORY_LABELS[task.category]}
                      {task.startMinutes != null &&
                        ` · ${formatMinutesToTime(task.startMinutes)}`}
                    </p>
                  </div>
                  <Badge color={TASK_STATUS_COLORS[task.status]}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Metas em andamento
            </h2>
            {inProgressGoals.length === 0 ? (
              <p className="text-sm text-subtle">Nenhuma meta ativa.</p>
            ) : (
              <ul className="space-y-2">
                {inProgressGoals.slice(0, 6).map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-center gap-2 text-sm text-muted"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: CATEGORY_COLORS[goal.category] }}
                    />
                    <span className="truncate">{goal.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Próximos lembretes
            </h2>
            {todayReminders.length === 0 ? (
              <p className="text-sm text-subtle">Nada para hoje.</p>
            ) : (
              <ul className="space-y-2.5">
                {todayReminders.map((reminder) => (
                  <li key={reminder.id} className="text-sm">
                    <span className="block text-xs font-medium text-brand-600">
                      {REMINDER_TYPE_LABELS[reminder.type]}
                      {" · "}
                      {formatMinutesToTime(reminder.startMinutes)}
                    </span>
                    <span className="text-muted">{reminder.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
