import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
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
import { CheckCircle2, Clock, Target, Bell, Plus } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateForInput());
  const [range, setRange] = useState<RangeDays>(14);

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

  async function handleStatus(id: number, next: TaskStatus) {
    const previous = tasks;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: next } : t)),
    );
    try {
      await virtualPlannerApi.updateTask(id, { status: next });
    } catch (error) {
      console.error("Erro ao mudar status:", error);
      setTasks(previous);
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
    () => occurrences.filter((o) => o.date === selectedDate),
    [occurrences, selectedDate],
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

  const marked = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => set.add(t.date));
    occurrences.forEach((o) => set.add(o.date));
    return set;
  }, [tasks, occurrences]);

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

      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">
            Produtividade de {dayLabel}
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
            <h2 className="mb-4 text-sm font-semibold text-ink">
              Agenda de {dayLabel}
            </h2>
            <DayTimeline tasks={dayTasks} onStatusChange={handleStatus} />

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
