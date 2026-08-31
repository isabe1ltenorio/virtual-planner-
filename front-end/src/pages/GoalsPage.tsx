import { useCallback, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, Target } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { GoalStatus } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  GOAL_PERIOD_LABELS,
  formatDateForInput,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_COLORS,
  formatDateShort,
} from "../lib/formatters";
import {
  Badge,
  Card,
  DangerConfirm,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { useApiResource } from "../hooks/useApiResource";
import type { GoalPeriodFilter } from "../lib/api/goalsApi";
import { buttonClass } from "../components/buttonStyles";

export function GoalsPage() {
  const [period, setPeriod] = useState<GoalPeriodFilter>("monthly");
  const [anchorDate, setAnchorDate] = useState(formatDateForInput());
  const [status, setStatus] = useState<"ALL" | GoalStatus>("ALL");
  const [deletingId, setDeletingId] = useState<number>();
  const [mutationError, setMutationError] = useState<string>();
  const load = useCallback(
    () => virtualPlannerApi.getGoals({ period, date: anchorDate }),
    [period, anchorDate],
  );
  const resource = useApiResource(load);
  const goals = resource.data ?? [];
  const filtered = goals.filter(
    (goal) => status === "ALL" || goal.status === status,
  );
  async function handleDelete(id: number) {
    if (deletingId !== undefined) return;
    setDeletingId(id);
    setMutationError(undefined);
    try {
      await virtualPlannerApi.deleteGoal(id);
      resource.retry();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a meta.",
      );
    } finally {
      setDeletingId(undefined);
    }
  }

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

      <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <Field label="Período">
          <select
            className="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof period)}
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        </Field>
        <Field label="Data de referência">
          <input
            type="date"
            className="input"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            required
          />
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

      {mutationError && <ErrorState message={mutationError} />}
      {resource.isLoading ? (
        <LoadingState label="Carregando metas…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Target size={28} strokeWidth={1.5} />}
          title="Nenhuma meta por aqui"
          description="Crie uma meta ou ajuste a janela e o status selecionados."
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
                <DangerConfirm
                  disabled={deletingId !== undefined}
                  onConfirm={() => handleDelete(goal.id)}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
