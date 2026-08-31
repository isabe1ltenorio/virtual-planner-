import type {
  Category,
  GoalPeriod,
  GoalStatus,
  Priority,
  ReminderRecurrence,
  ReminderType,
  Shift,
  TaskStatus,
} from "../types/domain";

/* -------------------------------------------------------------------------- */
/*  Datas e horários                                                          */
/* -------------------------------------------------------------------------- */

// Minutos acumulados do dia (540) -> "09:00"
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function formatDateForInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "2026-08-30" -> "30 de ago"
export function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${d} de ${months[m - 1]}`;
}

/* -------------------------------------------------------------------------- */
/*  Rótulos em português — o valor cru continua indo/vindo da API             */
/* -------------------------------------------------------------------------- */

export const CATEGORY_LABELS: Record<Category, string> = {
  College: "Faculdade",
  Work: "Trabalho",
  Health: "Saúde",
  Leisure: "Lazer",
  PersonalProjects: "Projetos Pessoais",
  Study: "Estudos",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  Low: "Baixa",
  Medium: "Média",
  High: "Alta",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  Pending: "Pendente",
  Executed: "Executada",
  PartiallyExecuted: "Parcial",
  Cancelled: "Cancelada",
  Postponed: "Adiada",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  "In Progress": "Em andamento",
  Completed: "Cumprida",
  "Partially Completed": "Parcialmente cumprida",
  Failed: "Não cumprida",
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  Weekly: "Semanal",
  Monthly: "Mensal",
  Yearly: "Anual",
};

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  Meeting: "Reunião",
  PhoneCall: "Ligação",
  Shopping: "Compras",
  Study: "Estudos",
  Exercise: "Exercícios",
  Assignment: "Entrega",
};

export const REMINDER_RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  Once: "Único",
  Daily: "Diário",
  Weekly: "Semanal",
  Monthly: "Mensal",
};

export const SHIFT_LABELS: Record<Shift, string> = {
  Morning: "Manhã",
  Afternoon: "Tarde",
  Evening: "Noite",
};

/* -------------------------------------------------------------------------- */
/*  Cor por categoria — mesma cor para tarefa e meta da mesma categoria       */
/*  Paleta harmônica: 6 matizes com croma parecido, ancorada na marca.        */
/* -------------------------------------------------------------------------- */

export const CATEGORY_COLORS: Record<Category, string> = {
  College: "#6366f1", // indigo
  Work: "#0ea5e9", // azul
  Health: "#10b981", // verde
  Leisure: "#f59e0b", // âmbar
  PersonalProjects: "#9333ea", // roxo (marca)
  Study: "#f43f5e", // rosa
};

/* Cores de status — sempre neutras/semânticas, nunca competem com a categoria */
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  Pending: "#71717a",
  Executed: "#10b981",
  PartiallyExecuted: "#f59e0b",
  Cancelled: "#ef4444",
  Postponed: "#8b5cf6",
};

export const GOAL_STATUS_COLORS: Record<GoalStatus, string> = {
  "In Progress": "#0ea5e9",
  Completed: "#10b981",
  "Partially Completed": "#f59e0b",
  Failed: "#ef4444",
};

// null indica ausência de dados; zero continua sendo uma medição válida.
export function formatRatio(value: number | null): string {
  return value === null
    ? "Sem dados"
    : `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function formatRankingLabel(label: string): string {
  if (Object.hasOwn(CATEGORY_LABELS, label))
    return CATEGORY_LABELS[label as Category];
  if (Object.hasOwn(SHIFT_LABELS, label)) return SHIFT_LABELS[label as Shift];
  return label;
}
