import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";
import { addDays, startOfWeek } from "date-fns";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { formatDateForInput, formatDateShort } from "../lib/formatters";
import type { TaskStatus } from "../types/domain";
import { useApiResource } from "../hooks/useApiResource";
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";
import { DayTimeline } from "../components/DayTimeline";

function visibleDates(date: string, view: "day" | "week"): string[] {
  const anchor = new Date(`${date}T00:00:00`);
  const start =
    view === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor;
  return Array.from({ length: view === "week" ? 7 : 1 }, (_, index) =>
    formatDateForInput(addDays(start, index)),
  );
}

export function PlannerPage() {
  const [date, setDate] = useState(formatDateForInput());
  const [view, setView] = useState<"day" | "week">("day");
  const [updatingId, setUpdatingId] = useState<number>();
  const [mutationError, setMutationError] = useState<string>();
  const navigate = useNavigate();
  const days = visibleDates(date, view);
  const load = useCallback(async () => {
    const dates = visibleDates(date, view);
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const [tasks, occurrences, conflicts] = await Promise.all([
      virtualPlannerApi.getTasks({ start_date: startDate, end_date: endDate }),
      virtualPlannerApi.getReminderOccurrences({
        start: startDate,
        end: endDate,
      }),
      Promise.all(dates.map((day) => virtualPlannerApi.getTaskConflicts(day))),
    ]);
    return {
      tasks,
      occurrences,
      conflictIds: new Set(
        conflicts
          .flat()
          .flatMap((pair) => [pair.first_task_id, pair.second_task_id]),
      ),
    };
  }, [date, view]);
  const resource = useApiResource(load);
  const data = resource.data;
  async function changeStatus(id: number, status: TaskStatus) {
    if (updatingId !== undefined) return;
    setUpdatingId(id);
    setMutationError(undefined);
    try {
      await virtualPlannerApi.updateTask(id, { status });
      resource.retry();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status.",
      );
    } finally {
      setUpdatingId(undefined);
    }
  }
  const move = (direction: number) =>
    setDate(
      formatDateForInput(
        addDays(
          new Date(`${date}T00:00:00`),
          direction * (view === "week" ? 7 : 1),
        ),
      ),
    );
  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle="Tarefas e ocorrências de lembretes, com conflitos informados pela API."
        actions={
          <Link to={`/tasks/new?date=${date}`} className="btn btn-primary">
            Nova tarefa
          </Link>
        }
      />
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <Field label="Data">
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </Field>
        <Field label="Visualização">
          <Select
            value={view}
            onChange={(e) => setView(e.target.value as typeof view)}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
          </Select>
        </Field>
        <Button type="button" variant="outline" onClick={() => move(-1)}>
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDate(formatDateForInput())}
        >
          Hoje
        </Button>
        <Button type="button" variant="outline" onClick={() => move(1)}>
          Próximo
        </Button>
      </Card>
      {mutationError && <ErrorState message={mutationError} />}
      {resource.isLoading ? (
        <LoadingState label="Montando a agenda…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        data && (
          <>
            {data.conflictIds.size > 0 && (
              <p
                role="status"
                className="text-sm font-medium text-red-700 dark:text-red-300"
              >
                {data.conflictIds.size} tarefa(s) com conflito de horário no
                período.
              </p>
            )}
            <div
              className={
                view === "week"
                  ? "flex items-start gap-4 overflow-x-auto pb-4"
                  : "space-y-4"
              }
            >
              {days.map((day) => (
                <Card
                  key={day}
                  className={view === "week" ? "w-[28rem] shrink-0 p-4" : "p-5"}
                >
                  <h2 className="mb-5 text-sm font-semibold text-ink">
                    {new Date(`${day}T00:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "long",
                    })}
                    , {formatDateShort(day)}
                  </h2>
                  <DayTimeline
                    tasks={data.tasks.filter((task) => task.date === day)}
                    occurrences={data.occurrences.filter(
                      (occurrence) => occurrence.date === day,
                    )}
                    conflictTaskIds={data.conflictIds}
                    updatingTaskIds={
                      updatingId === undefined
                        ? undefined
                        : new Set([updatingId])
                    }
                    onStatusChange={changeStatus}
                    onEmptyClick={(minutes) =>
                      navigate(`/tasks/new?date=${day}&start=${minutes}`)
                    }
                  />
                </Card>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
