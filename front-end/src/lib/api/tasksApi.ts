import type { Shift, Task } from "../../types/domain";
import { request } from "./httpClient";

// O backend fala `time_slot: { start, end }` em minutos; as telas usam
// `startMinutes` / `endMinutes`. O mapeamento fica aqui, como em goalsApi.

// Janela padrão que uma tarefa de turno ocupa quando o backend ainda não tem
// coluna `shift` (persistência real de turno é um passo à parte). Manhã 6-12,
// tarde 12-18, noite 18-24; o backend deriva o turno do início do time_slot.
const SHIFT_WINDOW: Record<Shift, { start: number; end: number }> = {
  Morning: { start: 6 * 60, end: 12 * 60 },
  Afternoon: { start: 12 * 60, end: 18 * 60 },
  Evening: { start: 18 * 60, end: 24 * 60 },
};

interface TaskWire {
  id: number;
  description: string;
  category: Task["category"];
  date: string;
  time_slot: { start: number; end: number };
  shift?: Shift;
  priority: Task["priority"];
  status: Task["status"];
}

function fromWire(wire: TaskWire): Task {
  return {
    id: wire.id,
    description: wire.description,
    category: wire.category,
    date: wire.date,
    startMinutes: wire.time_slot.start,
    endMinutes: wire.time_slot.end,
    shift: wire.shift,
    priority: wire.priority,
    status: wire.status,
  };
}

function timeSlotOf(data: Partial<Task>): { start: number; end: number } | undefined {
  if (data.startMinutes != null && data.endMinutes != null) {
    return { start: data.startMinutes, end: data.endMinutes };
  }
  if (data.shift) {
    return SHIFT_WINDOW[data.shift];
  }
  return undefined;
}

export async function listTasks(date?: string): Promise<Task[]> {
  const query = date ? { start_date: date, end_date: date } : undefined;
  const wire = await request<TaskWire[]>("/tasks", { query });
  return wire.map(fromWire);
}

export async function getTaskById(id: number): Promise<Task> {
  return fromWire(await request<TaskWire>(`/tasks/${id}`));
}

export async function createTask(data: Omit<Task, "id">): Promise<Task> {
  const time_slot = timeSlotOf(data);
  if (!time_slot) {
    throw new Error("Informe um horário ou um turno para a tarefa.");
  }

  // `status` não vai no POST: o caso de uso define o inicial (Pendente).
  const wire = await request<TaskWire>("/tasks", {
    method: "POST",
    body: {
      description: data.description,
      category: data.category,
      date: data.date,
      time_slot,
      priority: data.priority,
    },
  });
  return fromWire(wire);
}

export async function updateTask(
  id: number,
  updates: Partial<Task>,
): Promise<Task> {
  const { status, startMinutes, endMinutes, shift, color, ...rest } = updates;
  void color;

  const time_slot = timeSlotOf({ startMinutes, endMinutes, shift });
  const data: Record<string, unknown> = { ...rest };
  if (time_slot) data.time_slot = time_slot;

  let wire: TaskWire | undefined;

  // O backend separa: PATCH /api/tasks/:id muda os dados, PATCH
  // /api/tasks/:id/status muda o status. A tela manda tudo junto; dividimos
  // aqui, como em goalsApi.
  if (Object.keys(data).length > 0) {
    wire = await request<TaskWire>(`/tasks/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  if (status !== undefined) {
    wire = await request<TaskWire>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  }

  return wire ? fromWire(wire) : getTaskById(id);
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/tasks/${id}`, { method: "DELETE" });
}
