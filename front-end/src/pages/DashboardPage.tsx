import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { startOfMonth, startOfWeek } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  Target,
  Bell,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { ReminderOccurrence } from "../lib/api/remindersApi";
import type { Category, Task, Goal, TaskStatus } from "../types/domain";
import {
  formatDateForInput,
  formatDateShort,
  formatMinutesToTime,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  REMINDER_TYPE_LABELS,
} from "../lib/formatters";
import { Card, LoadingState, PageHeader, StatCard } from "../components/ui";
import { MiniCalendar } from "../components/MiniCalendar";
import { DayTimeline } from "../components/DayTimeline";
import { StatusMenu } from "../components/StatusMenu";
import { buttonClass } from "../components/buttonStyles";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
type RangeDays = 14 | 30;

// Neutros que funcionam nos dois temas (slate-400 com alfa na grade).
const CHART_GRID = "rgba(148,163,184,0.25)";
const CHART_AXIS = "#94a3b8";

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [occurrences, setOccurrences] = useState<ReminderOccurrence[]>([]);
  const [calendarOccurrences, setCalendarOccurrences] = useState<ReminderOccurrence[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => formatDateForInput().slice(0, 7));
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateForInput());
  const [range, setRange] = useState<RangeDays>(14);

  const navigate = useNavigate();
  const today = formatDateForInput();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const [t, g, r] = await Promise.allSettled([
        virtualPlannerApi.getTasks(),
        virtualPlannerApi.getGoals(),
        virtualPlannerApi.getReminderOccurrences(),
      ]);
      if (t.status === "fulfilled") setTasks(t.value);
      if (g.status === "fulfilled") setGoals(g.value);
      if (r.status === "fulfilled") setOccurrences(r.value);
      if (t.status === "rejected") console.error("tarefas:", t.reason);
      if (g.status === "rejected") console.error("metas:", g.reason);
      if (r.status === "rejected") console.error("lembretes:", r.reason);
      setIsLoading(false);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = startOfWeek(startOfMonth(new Date(`${calendarMonth}-01T00:00:00`)));
    const startDate = formatDateForInput(start);
    const endDate = formatDateForInput(addDays(start, 41));
    const requests = [virtualPlannerApi.getReminderOccurrences({
      start: startDate,
      end: endDate,
    })];
    // Navegar pelo calendário não troca o dia selecionado na agenda.
    if (selectedDate < startDate || selectedDate > endDate) {
      requests.push(virtualPlannerApi.getReminderOccurrences({
        start: selectedDate,
        end: selectedDate,
      }));
    }
    Promise.all(requests).then((items) => {
      if (!cancelled) setCalendarOccurrences(items.flat());
    }).catch((error) => console.error("lembretes do calendário:", error));
    return () => { cancelled = true; };
  }, [calendarMonth, selectedDate]);

  async function handleStatus(id: number, next: TaskStatus) {
    if (updatingTaskIds.has(id)) return;
    const previous = tasks.find((task) => task.id === id)?.status;
    setUpdatingTaskIds((prev) => new Set(prev).add(id));
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: next } : t)),
    );
    try {
      await virtualPlannerApi.updateTask(id, { status: next });
    } catch (error) {
      console.error("Erro ao mudar status:", error);
      setTasks((prev) => prev.map((task) =>
        task.id === id && previous !== undefined ? { ...task, status: previous } : task,
      ));
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
      tasks
        .filter((t) => t.date === selectedDate)
        .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0)),
    [tasks, selectedDate],
  );
  const dayReminders = useMemo(
    () => calendarOccurrences.filter((o) => o.date === selectedDate),
    [calendarOccurrences, selectedDate],
  );

  const inProgressGoals = goals.filter((g) => g.status === "In Progress");

  const executed = dayTasks.filter((t) => t.status === "Executed").length;
  const partial = dayTasks.filter(
    (t) => t.status === "PartiallyExecuted",
  ).length;
  const pending = dayTasks.filter((t) => t.status === "Pending").length;
  const productivity =
    dayTasks.length > 0
      ? Math.round(((executed + partial * 0.5) / dayTasks.length) * 100)
      : 0;
  // Dia futuro ou sem tarefas: não há o que medir, mostra "—" em vez de 0%.
  const productivityKnown = dayTasks.length > 0 && selectedDate <= today;

  // Pendentes/adiadas de dias passados: some do "hoje" mas continuam devendo.
  const overdue = useMemo(
    () =>
      tasks
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
    tasks.forEach((t) => set.add(t.date));
    occurrences.forEach((o) => set.add(o.date));
    calendarOccurrences.forEach((o) => set.add(o.date));
    return set;
  }, [tasks, occurrences, calendarOccurrences]);

  const statusData = useMemo(
    () =>
      STATUSES.map((s) => ({
        name: TASK_STATUS_LABELS[s],
        value: tasks.filter((t) => t.status === s).length,
        fill: TASK_STATUS_COLORS[s],
      })).filter((d) => d.value > 0),
    [tasks],
  );

  const execData = useMemo(() => {
    const start = addDays(new Date(`${today}T00:00:00`), -(range - 1));
    return Array.from({ length: range }, (_, i) => {
      const d = addDays(start, i);
      const key = formatDateForInput(d);
      return {
        label: d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        executadas: tasks.filter(
          (t) => t.date === key && t.status === "Executed",
        ).length,
      };
    });
  }, [tasks, range, today]);

  const categoryData = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        name: CATEGORY_LABELS[c],
        fill: CATEGORY_COLORS[c],
        tarefas: tasks.filter((t) => t.category === c).length,
        metas: goals.filter((g) => g.category === c).length,
      })).filter((d) => d.tarefas > 0 || d.metas > 0),
    [tasks, goals],
  );

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

    tasks
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

    occurrences
      .filter((o) => o.date >= today && o.date <= horizon)
      .forEach((o) =>
        items.push({
          key: `r${o.reminder.id}-${o.date}`,
          date: o.date,
          minutes: o.reminder.startMinutes,
          title: o.reminder.description,
          tag: REMINDER_TYPE_LABELS[o.reminder.type],
          color: "#9333ea",
        }),
      );

    return items
      .sort((a, b) =>
        a.date === b.date ? a.minutes - b.minutes : a.date < b.date ? -1 : 1,
      )
      .slice(0, 8);
  }, [tasks, occurrences, today]);

  if (isLoading) return <LoadingState label="Carregando seu dia…" />;

  const isEmpty =
    tasks.length === 0 && goals.length === 0 && occurrences.length === 0;

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

      {isEmpty && (
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-ink">
            Tudo pronto para começar.
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Crie sua primeira <strong>meta</strong> ou <strong>tarefa</strong> e
            o resumo do dia começa a ganhar forma.
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pendentes"
          value={pending}
          icon={<Clock size={16} />}
        />
        <StatCard
          label="Executadas"
          value={executed}
          icon={<CheckCircle2 size={16} />}
        />
        <StatCard
          label="Metas em andamento"
          value={inProgressGoals.length}
          icon={<Target size={16} />}
        />
        <StatCard
          label={`Lembretes ${dayLabel === "hoje" ? "hoje" : "no dia"}`}
          value={dayReminders.length}
          icon={<Bell size={16} />}
        />
      </div>

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
                    {formatDateShort(task.date)} · {CATEGORY_LABELS[task.category]}
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

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            Produtividade de {dayLabel}
          </span>
          <span className="stat-value text-lg font-semibold text-ink">
            {productivityKnown ? `${productivity}%` : "—"}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
            style={{ width: `${productivityKnown ? productivity : 0}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Tarefas por status
          </h2>
          {statusData.length === 0 ? (
            <p className="py-10 text-center text-sm text-subtle">
              Sem tarefas ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Execução</h2>
            <div className="inline-flex rounded-lg border border-border-c bg-surface p-0.5">
              {([14, 30] as RangeDays[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    range === r
                      ? "bg-brand-600 text-white"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={execData} margin={{ left: -20, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="exec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: CHART_AXIS }}
                interval="preserveStartEnd"
                minTickGap={24}
                axisLine={{ stroke: CHART_GRID }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: CHART_AXIS }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="executadas"
                stroke="#9333ea"
                strokeWidth={2}
                fill="url(#exec)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Por categoria</h2>
          {categoryData.length === 0 ? (
            <p className="py-10 text-center text-sm text-subtle">
              Sem tarefas nem metas ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ left: 4, right: 12 }}
              >
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: CHART_AXIS }}
                  axisLine={{ stroke: CHART_GRID }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={78}
                  tick={{ fontSize: 10, fill: CHART_AXIS }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tarefas" radius={[0, 4, 4, 0]} fill="#9333ea" />
                <Bar dataKey="metas" radius={[0, 4, 4, 0]} fill="#c084fc" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

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
            <DayTimeline
              tasks={dayTasks}
              updatingTaskIds={updatingTaskIds}
              onStatusChange={handleStatus}
              onEmptyClick={(minutes) =>
                navigate(`/tasks/new?date=${selectedDate}&start=${minutes}`)
              }
            />

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
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
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
            {upcoming.length === 0 ? (
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
        </div>
      </div>
    </>
  );
}
