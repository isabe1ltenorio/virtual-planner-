import type { Task } from "../../types/domain";
import { TaskCard } from "./TaskCard";

interface WeeklyBoardProps {
  tasks: Task[];
}

export function WeeklyBoard({ tasks }: WeeklyBoardProps) {
  const daysOfWeek = [
    { key: "2026-08-17", label: "Segunda", color: "text-blue-400" },
    { key: "2026-08-18", label: "Terça", color: "text-emerald-400" },
    { key: "2026-08-19", label: "Quarta", color: "text-amber-400" },
    { key: "2026-08-20", label: "Quinta", color: "text-orange-400" },
    { key: "2026-08-21", label: "Sexta", color: "text-rose-400" },
    { key: "2026-08-22", label: "Sábado", color: "text-purple-400" },
    { key: "2026-08-23", label: "Domingo", color: "text-purple-400" },
  ];

  const getTasksForDay = (dateString: string) => {
    return tasks.filter((task) => task.date === dateString);
  };

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 min-h-[70vh] items-start w-full">
      {daysOfWeek.map((day) => (
        <div
          key={day.key}
          className="flex flex-col min-w-[280px] max-w-[280px] bg-zinc-900/40 rounded-xl p-3 border border-zinc-800/50"
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className={`font-bold text-lg ${day.color}`}>{day.label}</h2>
            <span className="text-zinc-500 text-sm font-medium">
              {getTasksForDay(day.key).length}
            </span>
          </div>

          <div className="flex flex-col gap-3 mb-3">
            {getTasksForDay(day.key).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>

          <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/10 transition-colors mt-auto font-medium text-sm">
            <span className="text-lg leading-none">+</span>
            NOVO BLOCO
          </button>
        </div>
      ))}
    </div>
  );
}
