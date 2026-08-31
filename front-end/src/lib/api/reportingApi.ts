import type { GoalPeriodFilter } from "./goalsApi";
import { request } from "./httpClient";

export interface RankingEntry {
  label: string;
  total: number;
  score: number;
  ratio: number | null;
}

export interface ReportMetrics {
  start_date: string;
  end_date: string;
  goals_total: number;
  goals_completed: number;
  goals_partially_completed: number;
  goals_ratio: number | null;
  tasks_total: number;
  tasks_executed: number;
  tasks_partially_executed: number;
  tasks_ratio: number | null;
  most_productive_weeks: RankingEntry[];
  most_productive_months: RankingEntry[];
  most_productive_shifts: RankingEntry[];
  task_categories: RankingEntry[];
  goal_categories: RankingEntry[];
  productivity_index: number | null;
}

export function getReport(
  period: GoalPeriodFilter,
  date: string,
): Promise<ReportMetrics> {
  return request<ReportMetrics>("/reports", { query: { period, date } });
}

export function getDashboard(): Promise<ReportMetrics> {
  return request<ReportMetrics>("/dashboard");
}
