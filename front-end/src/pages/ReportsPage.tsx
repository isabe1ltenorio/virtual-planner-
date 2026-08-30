import { useEffect, useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Task, Goal } from "../types/domain";
import { calculateReportStats } from "../utils/reportCalculator";
import { Card, LoadingState, PageHeader, StatCard } from "../components/ui";

type Period = "week" | "month" | "year";

const PERIOD_LABEL: Record<Period, string> = {
  week: "Semana",
  month: "Mês",
  year: "Ano",
};

function ProgressRow({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-muted">{label}</span>
        <span className="stat-value font-semibold text-ink">{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <p className="mt-1 text-xs text-subtle">{detail}</p>
    </div>
  );
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      try {
        const [t, g] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getGoals(),
        ]);
        if (alive) {
          setTasks(t);
          setGoals(g);
        }
      } catch (error) {
        console.error("Erro ao carregar o relatório:", error);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { filteredTasks, filteredGoals } = useMemo(() => {
    const today = new Date();
    const range = {
      week: {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      },
      month: { start: startOfMonth(today), end: endOfMonth(today) },
      year: { start: startOfYear(today), end: endOfYear(today) },
    }[period];

    const periodByFilter = { week: "Weekly", month: "Monthly", year: "Yearly" }[
      period
    ];

    return {
      filteredTasks: tasks.filter(
        (t) => t.date && isWithinInterval(parseISO(t.date), range),
      ),
      filteredGoals: goals.filter((g) => g.period === periodByFilter),
    };
  }, [tasks, goals, period]);

  const stats = useMemo(
    () => calculateReportStats(filteredTasks, filteredGoals),
    [filteredTasks, filteredGoals],
  );

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle={`Produtividade por ${PERIOD_LABEL[period].toLowerCase()}.`}
        actions={
          <div className="inline-flex rounded-lg border border-border-c bg-surface p-0.5">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? "bg-brand-600 text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <LoadingState label="Calculando métricas…" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-6 p-6">
            <h2 className="text-sm font-semibold text-ink">
              Taxa de conclusão
            </h2>
            <ProgressRow
              label="Metas cumpridas"
              value={stats.goals.percentage}
              detail={`${stats.goals.completed} de ${stats.goals.total} metas`}
              color="#9333ea"
            />
            <ProgressRow
              label="Tarefas executadas"
              value={stats.tasks.percentage}
              detail={`${stats.tasks.completed} de ${stats.tasks.total} tarefas`}
              color="#10b981"
            />
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Turno mais produtivo"
              value={stats.bestShift}
            />
            <StatCard label="Melhor período" value={stats.bestPeriod} />
            <StatCard
              label="Top categoria — tarefas"
              value={stats.topTaskCategory}
            />
            <StatCard
              label="Top categoria — metas"
              value={stats.topGoalCategory}
            />
          </div>
        </div>
      )}
    </>
  );
}
