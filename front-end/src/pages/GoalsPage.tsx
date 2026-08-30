import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, Target } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Goal, GoalPeriod, GoalStatus } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  GOAL_PERIOD_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_COLORS,
  formatDateShort,
} from "../lib/formatters";
import {
  Badge,
  Card,
  DangerConfirm,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  buttonClass,
} from "../components/ui";

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"ALL" | GoalPeriod>("ALL");
  const [status, setStatus] = useState<"ALL" | GoalStatus>("ALL");

  useEffect(() => {
    virtualPlannerApi
      .getGoals()
      .then(setGoals)
      .catch((e) => console.error("Erro ao buscar metas:", e))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleDelete(id: number) {
    try {
      await virtualPlannerApi.deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error("Erro ao excluir meta:", error);
    }
  }

  const filtered = goals.filter(
    (g) =>
      (period === "ALL" || g.period === period) &&
      (status === "ALL" || g.status === status),
  );

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Progresso semanal, mensal e anual."
        actions={
          <Link to="/goals/new" className={buttonClass("primary")}>
            <Plus size={16} strokeWidth={2.5} />
            Nova meta
          </Link>
        }
      />

      <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <Field label="Período">
          <select
            className="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="ALL">Todos os períodos</option>
            {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriod[]).map((p) => (
              <option key={p} value={p}>
                {GOAL_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ALL">Todos os status</option>
            {(Object.keys(GOAL_STATUS_LABELS) as GoalStatus[]).map((s) => (
              <option key={s} value={s}>
                {GOAL_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {isLoading ? (
        <LoadingState label="Carregando metas…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Target size={28} strokeWidth={1.5} />}
          title="Nenhuma meta por aqui"
          description="Crie sua primeira meta para começar a acompanhar o progresso."
          action={
            <Link to="/goals/new" className={buttonClass("primary")}>
              <Plus size={16} strokeWidth={2.5} />
              Nova meta
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-border-c overflow-hidden">
          {filtered.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {goal.description}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {GOAL_PERIOD_LABELS[goal.period]} ·{" "}
                  {formatDateShort(goal.reference_date)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={CATEGORY_COLORS[goal.category]}>
                  {CATEGORY_LABELS[goal.category]}
                </Badge>
                <Badge color={GOAL_STATUS_COLORS[goal.status]}>
                  {GOAL_STATUS_LABELS[goal.status]}
                </Badge>
                <Link
                  to={`/goals/${goal.id}/edit`}
                  className={`${buttonClass("ghost")} text-muted`}
                >
                  <Pencil size={14} />
                  Editar
                </Link>
                <DangerConfirm onConfirm={() => handleDelete(goal.id)} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
