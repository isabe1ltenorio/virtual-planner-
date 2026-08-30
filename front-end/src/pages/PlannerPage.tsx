import { useEffect, useState } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";

type TimeSlotItem = {
  id: string;
  type: "Task" | "Reminder";
  description: string;
  startMinutes: number;
  endMinutes: number;
  hasConflict?: boolean;
};

export function PlannerPage() {
  const [items, setItems] = useState<TimeSlotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const SELECTED_DATE = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function loadAgenda() {
      setIsLoading(true);
      try {
        const [tasks, reminders] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getReminders(),
        ]);

        // Tarefa agendada por turno nao tem intervalo em minutos, e o
        // planejamento e uma linha do tempo: sem inicio e fim ela nao tem
        // onde ser desenhada. Antes disso os dois campos entravam como
        // undefined — a deteccao de conflito comparava undefined e nunca
        // acusava nada, e a ordenacao virava NaN.
        const hasInterval = (
            item: { startMinutes?: number; endMinutes?: number },
        ): boolean =>
          item.startMinutes !== undefined && item.endMinutes !== undefined;

        const dayTasks: TimeSlotItem[] = tasks
          .filter((t) => t.date === SELECTED_DATE && hasInterval(t))
          .map((t) => ({
            ...t,
            id: `task-${t.id}`,
            type: "Task",
            startMinutes: t.startMinutes as number,
            endMinutes: t.endMinutes as number,
          }));

        const dayReminders: TimeSlotItem[] = reminders
          .filter((r) => r.date === SELECTED_DATE)
          .map((r) => ({ ...r, id: `rem-${r.id}`, type: "Reminder" }));

        let agenda = [...dayTasks, ...dayReminders];

        agenda = agenda.map((item, i, arr) => {
          const hasConflict = arr.some(
            (other, j) =>
              i !== j &&
              item.startMinutes < other.endMinutes &&
              item.endMinutes > other.startMinutes,
          );
          return { ...item, hasConflict };
        });

        agenda.sort((a, b) => a.startMinutes - b.startMinutes);
        setItems(agenda);
      } catch (error) {
        console.error("Erro ao carregar planejamento:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAgenda();
  }, [SELECTED_DATE]);

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-full transition-colors">
      <header className="border-b border-gray-200 dark:border-purple-900/30 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Planejamento Diário
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Agenda para {SELECTED_DATE}
        </p>
      </header>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
        {isLoading ? (
          <p className="text-purple-600 dark:text-purple-400 animate-pulse">
            Carregando horários...
          </p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 italic">
            Nenhum evento agendado para hoje.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-l-4 shadow-sm transition-colors ${
                  item.hasConflict
                    ? "bg-red-50 dark:bg-red-950/20 border-red-500"
                    : "bg-white dark:bg-gray-800 border-purple-500"
                }`}
              >
                <div className="w-24 shrink-0 text-center">
                  <span className="block text-sm font-bold text-purple-700 dark:text-purple-300">
                    {formatTime(item.startMinutes)}
                  </span>
                  <span className="block text-xs text-gray-500">
                    até {formatTime(item.endMinutes)}
                  </span>
                </div>

                <div className="flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1">
                    {item.type === "Task" ? "Tarefa" : "Lembrete"}
                  </span>
                  <p
                    className={`text-lg font-medium ${item.hasConflict ? "text-red-700 dark:text-red-200" : "text-gray-900 dark:text-gray-200"}`}
                  >
                    {item.description}
                  </p>
                  {item.hasConflict && (
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-100 dark:bg-red-950/50 px-2 py-0.5 rounded mt-1 inline-block">
                      ⚠️ Conflito de Horário detectado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
