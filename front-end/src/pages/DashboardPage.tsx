import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { startOfMonth, startOfWeek } from "date-fns";
import { CheckCircle2, Clock, Target, Plus, AlertTriangle } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { useApiResource } from "../hooks/useApiResource";
import type { TaskStatus } from "../types/domain";
import {
  formatDateForInput,
  formatDateShort,
  formatMinutesToTime,
  formatRatio,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  REMINDER_TYPE_LABELS,
} from "../lib/formatters";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  StatCard,
} from "../components/ui";
import { MiniCalendar } from "../components/MiniCalendar";
import { DayTimeline } from "../components/DayTimeline";
import { StatusMenu } from "../components/StatusMenu";
import { ReportRanking } from "../components/ReportRanking";
import { buttonClass } from "../components/buttonStyles";

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function DashboardPage() {
  const [calendarMonth, setCalendarMonth] = useState(() =>
    formatDateForInput().slice(0, 7),
  );
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [mutationError, setMutationError] = useState<string>();
  const [selectedDate, setSelectedDate] = useState(formatDateForInput());

  const navigate = useNavigate();
  const today = formatDateForInput();

  const dashboard = useApiResource(virtualPlannerApi.getDashboard);
  const report = dashboard.data;
  const loadOverview = useCallback(async () => {
    const [tasks, goals, occurrences] = await Promise.all([
      virtualPlannerApi.getTasks(),
      virtualPlannerApi.getGoals({ period: "yearly", date: today }),
      virtualPlannerApi.getReminderOccurrences({
        start: today,
        end: formatDateForInput(addDays(new Date(`${today}T00:00:00`), 7)),
      }),
    ]);
    return { tasks, goals, occurrences };
  }, [today]);
  const overview = useApiResource(loadOverview);
  const tasks = overview.data?.tasks;
  const goals = overview.data?.goals;
  const occurrences = overview.data?.occurrences;

  const loadCalendar = useCallback(async () => {
    const start = startOfWeek(
      startOfMonth(new Date(`${calendarMonth}-01T00:00:00`)),
    );
    const startDate = formatDateForInput(start);
    const endDate = formatDateForInput(addDays(start, 41));
    const requests = [
      virtualPlannerApi.getReminderOccurrences({
        start: startDate,
        end: endDate,
      }),
    ];
    // Navegar pelo calendário não troca o dia selecionado na agenda.
    if (selectedDate < startDate || selectedDate > endDate) {
      requests.push(
        virtualPlannerApi.getReminderOccurrences({
          start: selectedDate,
          end: selectedDate,
        }),
      );
    }
    return (await Promise.all(requests)).flat();
  }, [calendarMonth, selectedDate]);
  const calendar = useApiResource(loadCalendar);
  const calendarOccurrences = calendar.data;

  async function handleStatus(id: number, next: TaskStatus) {
    if (updatingTaskIds.has(id)) return;
    setMutationError(undefined);
    setUpdatingTaskIds((prev) => new Set(prev).add(id));
    try {
      await virtualPlannerApi.updateTask(id, { status: next });
      overview.retry();
      dashboard.retry();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a tarefa.",
      );
    } finally {
      setUpdatingTaskIds((prev) => {
        const pending = new Set(prev);
        pending.delete(id);
        return pending;
      });
    }
  }

  const dayLabel = useMemo(() => {
    const d = new Date(`${selectedDate}T00:00:00`);
    if (selectedDate === today) return "hoje";
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  }, [selectedDate, today]);

  const dayTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0)),
    [tasks, selectedDate],
  );
  const dayReminders = useMemo(
    () => (calendarOccurrences ?? []).filter((o) => o.date === selectedDate),
    [calendarOccurrences, selectedDate],
  );

  const inProgressGoals = (goals ?? []).filter(
    (g) => g.status === "In Progress",
  );

  // Pendentes/adiadas de dias passados: some do "hoje" mas continuam devendo.
  const overdue = useMemo(
    () =>
      (tasks ?? [])
        .filter(
          (t) =>
            t.date < today &&
            (t.status === "Pending" || t.status === "Postponed"),
        )
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [tasks, today],
  );

  const marked = useMemo(() => {
    const set = new Set<string>();
    tasks?.forEach((t) => set.add(t.date));
    occurrences?.forEach((o) => set.add(o.date));
    calendarOccurrences?.forEach((o) => set.add(o.date));
    return set;
  }, [tasks, occurrences, calendarOccurrences]);

  const upcoming = useMemo(() => {
    const horizon = formatDateForInput(
      addDays(new Date(`${today}T00:00:00`), 7),
    );
    type Item = {
      key: string;
      date: string;
      minutes: number;
      title: string;
      tag: string;
      color: string;
    };
    const items: Item[] = [];

    (tasks ?? [])
      .filter((t) => t.date >= today && t.date <= horizon)
      .forEach((t) =>
        items.push({
          key: `t${t.id}-${t.date}`,
          date: t.date,
          minutes: t.startMinutes ?? 0,
          title: t.description,
          tag: CATEGORY_LABELS[t.category],
          color: CATEGORY_COLORS[t.category],
        }),
      );

    (occurrences ?? [])
      .filter((o) => o.date >= today && o.date <= horizon)
      .forEach((o) =>
        items.push({
          key: `r${o.reminder.id}-${o.date}`,
          date: o.date,
          minutes: o.reminder.startMinutes,
          title: o.reminder.description,
          tag: REMINDER_TYPE_LABELS[o.reminder.type],
          color: CATEGORY_COLORS[o.reminder.category],
        }),
      );

    return items
      .sort((a, b) =>
        a.date === b.date ? a.minutes - b.minutes : a.date < b.date ? -1 : 1,
      )
      .slice(0, 8);
  }, [tasks, occurrences, today]);

  const isEmpty =
    tasks?.length === 0 && goals?.length === 0 && occurrences?.length === 0;

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

      {overview.error && (
        <ErrorState message={overview.error} onRetry={overview.retry} />
      )}
      {mutationError && <ErrorState message={mutationError} />}

      {isEmpty && (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-ink">
            Nada agendado para os próximos dias.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Use os atalhos para incluir uma <strong>meta</strong> ou{" "}
            <strong>tarefa</strong>.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link to="/tasks/new" className={buttonClass("primary")}>
              <Plus size={16} strokeWidth={2.5} />
              Nova tarefa
            </Link>
            <Link to="/goals/new" className={buttonClass("outline")}>
              Nova meta
            </Link>
          </div>
        </Card>
      )}

      <section
        aria-labelledby="dashboard-metrics-heading"
        className="space-y-4"
      >
        <h2
          id="dashboard-metrics-heading"
          className="text-sm font-semibold text-ink"
        >
          Indicadores de hoje
        </h2>
        {dashboard.isLoading ? (
          <LoadingState label="Carregando indicadores…" />
        ) : dashboard.error ? (
          <ErrorState message={dashboard.error} onRetry={dashboard.retry} />
        ) : (
          report && (
            <>
              <p className="text-xs text-muted">
                {formatDateShort(report.start_date)} · Dia civil do servidor. O
                calendário altera somente a agenda.
              </p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Tarefas de hoje"
                  value={report.tasks_total}
                  icon={<Clock size={16} />}
                />
                <StatCard
                  label="Executadas hoje"
                  value={report.tasks_executed}
                  icon={<CheckCircle2 size={16} />}
                  hint={`${report.tasks_partially_executed} parcialmente executadas`}
                />
                <StatCard
                  label="Metas de hoje"
                  value={report.goals_total}
                  icon={<Target size={16} />}
                />
                <StatCard
                  label="Metas cumpridas hoje"
                  value={report.goals_completed}
                  icon={<CheckCircle2 size={16} />}
                  hint={`${report.goals_partially_completed} parcialmente cumpridas`}
                />
              </div>
              <Card className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted">
                    Índice de produtividade de hoje
                  </span>
                  <span className="stat-value text-lg font-semibold text-ink">
                    {formatRatio(report.productivity_index)}
                  </span>
                </div>
                {report.productivity_index !== null && (
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                      style={{ width: `${report.productivity_index * 100}%` }}
                    />
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  Tarefas: {formatRatio(report.tasks_ratio)} · Metas:{" "}
                  {formatRatio(report.goals_ratio)}
                </p>
              </Card>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                <ReportRanking
                  title="Categorias de tarefas — hoje"
                  entries={report.task_categories}
                />
                <ReportRanking
                  title="Categorias de metas — hoje"
                  entries={report.goal_categories}
                />
                <ReportRanking
                  title="Turnos mais produtivos — hoje"
                  entries={report.most_productive_shifts}
                />
              </div>
            </>
          )
        )}
      </section>

      {overdue.length > 0 && (
        <Card className="border-amber-300 p-5 dark:border-amber-500/40">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-ink">
              Atrasadas ({overdue.length})
            </h2>
          </div>
          <ul className="divide-y divide-border-c">
            {overdue.slice(0, 6).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[task.category] }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/tasks/${task.id}/edit`}
                    className="block truncate text-sm font-medium text-ink hover:underline"
                  >
                    {task.description}
                  </Link>
                  <p className="text-xs text-muted">
                    {formatDateShort(task.date)} ·{" "}
                    {CATEGORY_LABELS[task.category]}
                  </p>
                </div>
                <StatusMenu
                  value={task.status}
                  disabled={updatingTaskIds.has(task.id)}
                  onChange={(next) => handleStatus(task.id, next)}
                />
              </li>
            ))}
          </ul>
          {overdue.length > 6 && (
            <p className="mt-2 text-xs text-subtle">
              e mais {overdue.length - 6}…
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agenda do dia */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Agenda de {dayLabel}
              </h2>
              <Link
                to={`/tasks/new?date=${selectedDate}`}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                + agendar
              </Link>
            </div>
            {overview.isLoading || calendar.isLoading ? (
              <LoadingState label="Carregando agenda…" />
            ) : calendar.error ? (
              <ErrorState message={calendar.error} onRetry={calendar.retry} />
            ) : (
              !overview.error && (
                <>
                  <p className="mb-3 text-xs text-muted">
                    {dayTasks.length} tarefas · {dayReminders.length} lembretes
                  </p>
                  <DayTimeline
                    tasks={dayTasks}
                    occurrences={dayReminders}
                    updatingTaskIds={updatingTaskIds}
                    onStatusChange={handleStatus}
                    onEmptyClick={(minutes) =>
                      navigate(
                        `/tasks/new?date=${selectedDate}&start=${minutes}`,
                      )
                    }
                  />
                </>
              )
            )}

            {dayReminders.length > 0 && (
              <div className="mt-4 border-t border-border-c pt-3">
                <p className="mb-2 text-xs font-medium text-subtle">
                  Lembretes
                </p>
                <ul className="space-y-2">
                  {dayReminders
                    .slice()
                    .sort(
                      (a, b) =>
                        a.reminder.startMinutes - b.reminder.startMinutes,
                    )
                    .map((o) => (
                      <li
                        key={`${o.reminder.id}-${o.date}`}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{
                            background: CATEGORY_COLORS[o.reminder.category],
                          }}
                        />
                        <span className="tabular-nums text-xs text-muted">
                          {formatMinutesToTime(o.reminder.startMinutes)}
                        </span>
                        <span className="truncate text-ink">
                          {o.reminder.description}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-subtle">
                          {REMINDER_TYPE_LABELS[o.reminder.type]}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        {/* Trilho direito */}
        <div className="space-y-6">
          <Card className="p-5">
            <MiniCalendar
              value={selectedDate}
              onChange={setSelectedDate}
              onMonthChange={setCalendarMonth}
              marked={marked}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Próximos</h2>
            {overview.isLoading ? (
              <p className="text-sm text-muted">Carregando próximos itens…</p>
            ) : overview.error ? (
              <p className="text-sm text-muted">
                Os próximos itens não puderam ser carregados.
              </p>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-subtle">Nada nos próximos 7 dias.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((item) => (
                  <li key={item.key} className="flex gap-3 text-sm">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateShort(item.date)}
                        {item.minutes > 0 &&
                          ` · ${formatMinutesToTime(item.minutes)}`}
                        {" · "}
                        {item.tag}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Metas em andamento
            </h2>
            {overview.isLoading ? (
              <p className="text-sm text-muted">Carregando metas…</p>
            ) : overview.error ? (
              <p className="text-sm text-muted">
                As metas não puderam ser carregadas.
              </p>
            ) : inProgressGoals.length === 0 ? (
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
        </div>
      </div>
    </>
  );
}
