export type Category =
  "College" | "Work" | "Health" | "Leisure" | "PersonalProjects" | "Study";

export type GoalPeriod = "Weekly" | "Monthly" | "Yearly";

export type GoalStatus =
  "In Progress" | "Completed" | "Partially Completed" | "Failed";

export type Priority = "Low" | "Medium" | "High";

export type ReminderRecurrence = "Once" | "Daily" | "Weekly" | "Monthly";

export type ReminderType =
  "Meeting" | "PhoneCall" | "Shopping" | "Study" | "Exercise" | "Assignment";

export type Shift = "Morning" | "Afternoon" | "Evening";

export type TaskStatus =
  "Pending" | "Executed" | "PartiallyExecuted" | "Cancelled" | "Postponed";

// Regra de sobreposição de horários
export interface TimeSlot {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

// Visões do Planner
export type PlannerView =
  | "calendar"
  | "timeline"
  | "category"
  | "status"
  | "duration-category"
  | "duration-status"
  | "duration-time"
  | "priority"
  | "all";

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Task {
  id: number;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  startMinutes?: number;
  endMinutes?: number;
  shift?: Shift;
  priority: Priority;
  status: TaskStatus;
  color?: string;
}

export interface Goal {
  id: number;
  description: string;
  category: Category;
  status: GoalStatus;
  period: GoalPeriod;
  reference_date: string;
}

export interface Reminder {
  id: number;
  description: string;
  category: Category;
  date: string;
  startMinutes: number;
  endMinutes: number;
  type: ReminderType;
  recurrence: ReminderRecurrence;
}

export type CategoryColorMap = Record<Category, string>;
