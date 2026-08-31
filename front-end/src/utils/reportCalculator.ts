import type { Task, Goal, Category } from "../types/domain";
import {
  CATEGORY_LABELS,
  SHIFT_LABELS,
  formatDateShort,
} from "../lib/formatters";

export interface ReportStats {
  // percentage = (executadas + parciais·0,5) / total — mesma fórmula do
  // Dashboard e do relatório do backend.
  tasks: {
    total: number;
    executed: number;
    partial: number;
    percentage: number;
  };
  goals: {
    total: number;
    completed: number;
    partial: number;
    percentage: number;
  };
  topTaskCategory: string;
  topGoalCategory: string;
  bestShift: string;
  bestPeriod: string;
}

const pct = (score: number, total: number) =>
  total > 0 ? Math.round((score / total) * 100) : 0;

export function calculateReportStats(
  tasks: Task[],
  goals: Goal[],
): ReportStats {
  const executedTasks = tasks.filter((t) => t.status === "Executed");
  const partialTasks = tasks.filter((t) => t.status === "PartiallyExecuted");
  const completedTasks = [...executedTasks, ...partialTasks];

  const completedGoalsFull = goals.filter((g) => g.status === "Completed");
  const partialGoals = goals.filter((g) => g.status === "Partially Completed");
  const completedGoals = [...completedGoalsFull, ...partialGoals];

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

  // Turno explícito ou derivado do horário inicial.
  const shiftCounts: Record<string, number> = { Manhã: 0, Tarde: 0, Noite: 0 };
  completedTasks.forEach((t) => {
    if (t.shift) {
      shiftCounts[SHIFT_LABELS[t.shift]]++;
    } else if (t.startMinutes !== undefined) {
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
      executed: executedTasks.length,
      partial: partialTasks.length,
      percentage: pct(
        executedTasks.length + partialTasks.length * 0.5,
        tasks.length,
      ),
    },
    goals: {
      total: goals.length,
      completed: completedGoalsFull.length,
      partial: partialGoals.length,
      percentage: pct(
        completedGoalsFull.length + partialGoals.length * 0.5,
        goals.length,
      ),
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
