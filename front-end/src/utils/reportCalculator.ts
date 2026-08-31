import type { Task, Goal, Category } from "../types/domain";
import { CATEGORY_LABELS, formatDateShort } from "../lib/formatters";

export interface ReportStats {
  tasks: { total: number; completed: number; percentage: number };
  goals: { total: number; completed: number; percentage: number };
  topTaskCategory: string;
  topGoalCategory: string;
  bestShift: string;
  bestPeriod: string;
}

export function calculateReportStats(
  tasks: Task[],
  goals: Goal[],
): ReportStats {
  const completedTasks = tasks.filter((t) =>
    ["Executed", "PartiallyExecuted"].includes(t.status),
  );

  const completedGoals = goals.filter((g) =>
    ["Completed", "Partially Completed"].includes(g.status),
  );

  // Auxiliar para identificar a categoria mais frequente (rótulo em PT).
  const getTopCategory = (categories: Category[]) => {
    if (!categories.length) return "—";
    const counts = categories.reduce(
      (acc, cat) => {
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const top = Object.keys(counts).sort(
      (a, b) => counts[b] - counts[a],
    )[0] as Category;
    return CATEGORY_LABELS[top];
  };

  // Turno mais produtivo baseado nos minutos
  const shiftCounts = { Manhã: 0, Tarde: 0, Noite: 0 };
  completedTasks.forEach((t) => {
    if (t.startMinutes !== undefined) {
      if (t.startMinutes < 720) shiftCounts["Manhã"]++;
      else if (t.startMinutes < 1080) shiftCounts["Tarde"]++;
      else shiftCounts["Noite"]++;
    }
  });

  const topShift = Object.entries(shiftCounts).sort(([, a], [, b]) => b - a)[0];

  // Pico de entregas (Dia com mais tarefas executadas)
  const periodCounts: Record<string, number> = {};
  completedTasks.forEach((t) => {
    if (t.date) {
      periodCounts[t.date] = (periodCounts[t.date] || 0) + 1;
    }
  });

  const bestPeriodKey =
    Object.keys(periodCounts).sort(
      (a, b) => periodCounts[b] - periodCounts[a],
    )[0] || "Nenhum";

  return {
    tasks: {
      total: tasks.length,
      completed: completedTasks.length,
      percentage: tasks.length
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0,
    },
    goals: {
      total: goals.length,
      completed: completedGoals.length,
      percentage: goals.length
        ? Math.round((completedGoals.length / goals.length) * 100)
        : 0,
    },
    topTaskCategory: getTopCategory(completedTasks.map((t) => t.category)),
    topGoalCategory: getTopCategory(completedGoals.map((g) => g.category)),
    bestShift: topShift && topShift[1] > 0 ? topShift[0] : "—",
    bestPeriod:
      bestPeriodKey && bestPeriodKey !== "Nenhum"
        ? formatDateShort(bestPeriodKey)
        : "—",
  };
}
