import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, LayoutGrid, List, CheckSquare } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Category, Task, TaskStatus, Priority } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  PRIORITY_LABELS,
  formatMinutesToTime,
  formatDateShort,
  SHIFT_LABELS,
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
import { buttonClass } from "../components/buttonStyles";

type View = "list" | "board";
type GroupBy = "category" | "status";

const PRIORITY_COLORS: Record<Priority, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#ef4444",
};

function taskTime(task: Task): string | null {
  if (task.startMinutes != null) return formatMinutesToTime(task.startMinutes);
  if (task.shift) return SHIFT_LABELS[task.shift];
  return null;
}

export function TasksPage() {
  const [status, setStatus] = useState<"ALL" | TaskStatus>("ALL");
  const [category, setCategory] = useState<"ALL" | Category>("ALL");
  const [view, setView] = useState<View>("list");
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  const [priority, setPriority] = useState<"ALL" | Priority>("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deletingId, setDeletingId] = useState<number>();
  const [mutationError, setMutationError] = useState<string>();
  const load = useCallback(
    () =>
      virtualPlannerApi.getTasks({
        start_date: startDate,
        end_date: endDate,
        status: status === "ALL" ? undefined : status,
        category: category === "ALL" ? undefined : category,
        priority: priority === "ALL" ? undefined : priority,
      }),
    [startDate, endDate, status, category, priority],
  );
  const resource = useApiResource(load);
  const filtered = useMemo(() => resource.data ?? [], [resource.data]);
  async function handleDelete(id: number) {
    if (deletingId !== undefined) return;
    setDeletingId(id);
    setMutationError(undefined);
    try {
      await virtualPlannerApi.deleteTask(id);
      resource.retry();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a tarefa.",
      );
    } finally {
      setDeletingId(undefined);
    }
  }

  const columns = useMemo(() => {
    const keys =
      groupBy === "category"
        ? (Object.keys(CATEGORY_LABELS) as Category[])
        : (Object.keys(TASK_STATUS_LABELS) as TaskStatus[]);
    return keys
      .map((key) => ({
        key,
        label:
          groupBy === "category"
            ? CATEGORY_LABELS[key as Category]
            : TASK_STATUS_LABELS[key as TaskStatus],
        color:
          groupBy === "category"
            ? CATEGORY_COLORS[key as Category]
            : TASK_STATUS_COLORS[key as TaskStatus],
        items: filtered.filter((t) =>
          groupBy === "category" ? t.category === key : t.status === key,
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [filtered, groupBy]);

  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle="O que você vai fazer — com horário ou turno, categoria e prioridade. Entram no relatório de produtividade."
        actions={
          <Link to="/tasks/new" className={buttonClass("primary")}>
            <Plus size={16} strokeWidth={2.5} />
            Nova tarefa
          </Link>
        }
      />

      <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Status">
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ALL">Todos</option>
            {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="ALL">Todas</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prioridade">
          <select
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
          >
            <option value="ALL">Todas</option>
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data inicial">
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="Data final">
          <input
            type="date"
            className="input"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
        <div className="flex items-end gap-2">
          <div className="inline-flex rounded-lg border border-border-c bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`icon-btn ${view === "list" ? "bg-surface-2 text-ink" : ""}`}
              aria-label="Lista"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={`icon-btn ${view === "board" ? "bg-surface-2 text-ink" : ""}`}
              aria-label="Quadro"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          {view === "board" && (
            <select
              className="select w-auto"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            >
              <option value="category">Por categoria</option>
              <option value="status">Por status</option>
            </select>
          )}
        </div>
      </Card>

      {mutationError && <ErrorState message={mutationError} />}
      {resource.isLoading ? (
        <LoadingState label="Carregando tarefas…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} strokeWidth={1.5} />}
          title="Nenhuma tarefa"
          description="Crie sua primeira tarefa ou ajuste os filtros."
          action={
            <Link to="/tasks/new" className={buttonClass("primary")}>
              <Plus size={16} strokeWidth={2.5} />
              Nova tarefa
            </Link>
          }
        />
      ) : view === "list" ? (
        <Card className="divide-y divide-border-c overflow-hidden">
          {filtered.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[task.category] }}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {task.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateShort(task.date)} ·{" "}
                    {CATEGORY_LABELS[task.category]}
                    {taskTime(task) && ` · ${taskTime(task)}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={PRIORITY_COLORS[task.priority]}>
                  {PRIORITY_LABELS[task.priority]}
                </Badge>
                <Badge color={TASK_STATUS_COLORS[task.status]}>
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
                <Link
                  to={`/tasks/${task.id}/edit`}
                  className={`${buttonClass("ghost")} text-muted`}
                >
                  <Pencil size={14} />
                  Editar
                </Link>
                <DangerConfirm
                  disabled={deletingId !== undefined}
                  onConfirm={() => handleDelete(task.id)}
                />
              </div>
            </div>
          ))}
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => (
            <div key={String(col.key)} className="w-72 shrink-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: col.color }}
                />
                <span className="text-sm font-medium text-ink">
                  {col.label}
                </span>
                <span className="text-xs text-subtle">{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}/edit`}
                    className="card card-hover block p-3"
                  >
                    <p className="text-sm font-medium text-ink">
                      {task.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge
                        color={
                          groupBy === "category"
                            ? TASK_STATUS_COLORS[task.status]
                            : CATEGORY_COLORS[task.category]
                        }
                      >
                        {groupBy === "category"
                          ? TASK_STATUS_LABELS[task.status]
                          : CATEGORY_LABELS[task.category]}
                      </Badge>
                      <Badge color={PRIORITY_COLORS[task.priority]}>
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
