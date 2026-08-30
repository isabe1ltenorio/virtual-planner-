import type { ReminderRecurrence } from "../types/domain";

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Um lembrete "acontece" em `date` (dia civil local)?
 *
 * Espelha, de forma simplificada, o ListRemindersUseCase do backend. O caso
 * mensal não trata meses sem o dia 31 — igual ao mock; quem quiser o
 * comportamento exato usa a expansão do servidor.
 */
export function occursOn(
  reminder: { date: string; recurrence: ReminderRecurrence },
  date: Date,
): boolean {
  const base = atMidnight(parseLocalDate(reminder.date));
  const target = atMidnight(date);
  if (target < base) return false;

  switch (reminder.recurrence) {
    case "Once":
      return base.getTime() === target.getTime();
    case "Daily":
      return true;
    case "Weekly": {
      const days = Math.round(
        (target.getTime() - base.getTime()) / 86_400_000,
      );
      return days % 7 === 0;
    }
    case "Monthly":
      return base.getDate() === target.getDate();
    default:
      return false;
  }
}
