import type { Reminder } from "../../types/domain";
import { request } from "./httpClient";

// O backend fala `time_slot: { start, end }` em minutos; as telas usam
// `startMinutes` / `endMinutes`. Mapeamento aqui, como em goalsApi / tasksApi.

interface ReminderWire {
  id: number;
  description: string;
  category: Reminder["category"];
  date: string;
  time_slot: { start: number; end: number };
  type: Reminder["type"];
  recurrence: Reminder["recurrence"];
}

// GET /api/reminders devolve OCORRÊNCIAS expandidas, não as regras.
interface OccurrenceWire {
  reminder: ReminderWire;
  occurrence_date: string;
}

function fromWire(wire: ReminderWire): Reminder {
  return {
    id: wire.id,
    description: wire.description,
    category: wire.category,
    date: wire.date,
    startMinutes: wire.time_slot.start,
    endMinutes: wire.time_slot.end,
    type: wire.type,
    recurrence: wire.recurrence,
  };
}

function toWireBody(data: Omit<Reminder, "id">) {
  return {
    description: data.description,
    category: data.category,
    date: data.date,
    time_slot: { start: data.startMinutes, end: data.endMinutes },
    type: data.type,
    recurrence: data.recurrence,
  };
}

function isoOffsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// `GET /api/reminders` exige start_date e end_date e não tem "listar tudo".
// A tela de Lembretes quer as regras ativas, então usamos uma janela ampla
// (um mês atrás até um ano à frente) e removemos as ocorrências repetidas de
// um mesmo lembrete recorrente. Mesmo compromisso do default de goalsApi.
export async function listReminders(range?: {
  start: string;
  end: string;
}): Promise<Reminder[]> {
  const start = range?.start ?? isoOffsetDays(-31);
  const end = range?.end ?? isoOffsetDays(365);

  const occurrences = await request<OccurrenceWire[]>("/reminders", {
    query: { start_date: start, end_date: end },
  });

  const byId = new Map<number, Reminder>();
  for (const occ of occurrences) {
    if (!byId.has(occ.reminder.id)) {
      byId.set(occ.reminder.id, fromWire(occ.reminder));
    }
  }
  return [...byId.values()];
}

export async function getReminderById(id: number): Promise<Reminder> {
  return fromWire(await request<ReminderWire>(`/reminders/${id}`));
}

export async function createReminder(
  data: Omit<Reminder, "id">,
): Promise<Reminder> {
  const wire = await request<ReminderWire>("/reminders", {
    method: "POST",
    body: toWireBody(data),
  });
  return fromWire(wire);
}

export async function updateReminder(
  id: number,
  data: Omit<Reminder, "id">,
): Promise<Reminder> {
  // O backend usa PUT e substitui todos os campos editáveis (não é merge).
  const wire = await request<ReminderWire>(`/reminders/${id}`, {
    method: "PUT",
    body: toWireBody(data),
  });
  return fromWire(wire);
}

export async function deleteReminder(id: number): Promise<void> {
  await request<void>(`/reminders/${id}`, { method: "DELETE" });
}
