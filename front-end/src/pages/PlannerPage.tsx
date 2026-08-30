import { useEffect, useState } from "react";
import { CalendarDays, TriangleAlert } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import {
  formatDateForInput,
  formatMinutesToTime,
  SHIFT_LABELS,
} from "../lib/formatters";
import type { Shift } from "../types/domain";
import { Card, EmptyState, LoadingState, PageHeader } from "../components/ui";

type AgendaItem = {
  id: string;
  type: "Task" | "Reminder";
  description: string;
  startMinutes?: number;
  endMinutes?: number;
  shift?: Shift;
  hasConflict?: boolean;
};

export function PlannerPage() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const date = formatDateForInput();

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [tasks, reminders] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getReminders(),
        ]);

        const dayTasks: AgendaItem[] = tasks
          .filter((t) => t.date === date)
          .map((t) => ({
            id: `task-${t.id}`,
            type: "Task",
            description: t.description,
            startMinutes: t.startMinutes,
            endMinutes: t.endMinutes,
            shift: t.shift,
          }));

        const dayReminders: AgendaItem[] = reminders
          .filter((r) => r.date === date)
          .map((r) => ({
            id: `rem-${r.id}`,
            type: "Reminder",
            description: r.description,
            startMinutes: r.startMinutes,
            endMinutes: r.endMinutes,
          }));

        const agenda = [...dayTasks, ...dayReminders].map((item, i, arr) => ({
          ...item,
          hasConflict:
            item.startMinutes != null &&
            item.endMinutes != null &&
            arr.some(
              (other, j) =>
                i !== j &&
                other.startMinutes != null &&
                other.endMinutes != null &&
                item.startMinutes! < other.endMinutes! &&
                item.endMinutes! > other.startMinutes!,
            ),
        }));

        agenda.sort(
          (a, b) => (a.startMinutes ?? 1e9) - (b.startMinutes ?? 1e9),
        );
        setItems(agenda);
      } catch (error) {
        console.error("Erro ao carregar o planejamento:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [date]);

  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      {isLoading ? (
        <LoadingState label="Montando a agenda…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} strokeWidth={1.5} />}
          title="Dia livre"
          description="Nenhuma tarefa ou lembrete agendado para hoje."
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`flex items-center gap-4 p-4 ${
                item.hasConflict
                  ? "border-red-300 dark:border-red-900"
                  : ""
              }`}
            >
              <div className="w-20 shrink-0 text-center">
                {item.startMinutes != null ? (
                  <>
                    <span className="stat-value block text-sm font-semibold text-ink">
                      {formatMinutesToTime(item.startMinutes)}
                    </span>
                    {item.endMinutes != null && (
                      <span className="block text-xs text-subtle">
                        {formatMinutesToTime(item.endMinutes)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs font-medium text-muted">
                    {item.shift ? SHIFT_LABELS[item.shift] : "—"}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                  {item.type === "Task" ? "Tarefa" : "Lembrete"}
                </span>
                <p className="truncate font-medium text-ink">
                  {item.description}
                </p>
                {item.hasConflict && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600">
                    <TriangleAlert size={12} />
                    Conflito de horário
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
