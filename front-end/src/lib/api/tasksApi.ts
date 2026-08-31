import type { Shift, Task } from "../../types/domain";
import { request } from "./httpClient";

// O backend aceita agendar por HORÁRIO (`time_slot: { start, end }` em minutos)
// ou por TURNO (`shift`), e responde `scheduled_by_shift` dizendo qual foi.
// As telas usam `startMinutes` / `endMinutes` / `shift`. O mapeamento fica aqui.

interface TaskWire {
  id: number;
  description: string;
  category: Task["category"];
  date: string;
  time_slot: { start: number; end: number };
  shift?: Shift;
  scheduled_by_shift: boolean;
  priority: Task["priority"];
  status: Task["status"];
}

function fromWire(wire: TaskWire): Task {
  const base = {
    id: wire.id,
    description: wire.description,
    category: wire.category,
    date: wire.date,
    priority: wire.priority,
    status: wire.status,
  };

  if (wire.scheduled_by_shift) {
    // Tarefa de turno: a tela mostra o turno, não o horário sintético.
    return { ...base, shift: wire.shift };
  }
  return {
    ...base,
    startMinutes: wire.time_slot.start,
    endMinutes: wire.time_slot.end,
  };
}

// Monta o campo de agendamento do corpo: horário se houver, senão turno.
function scheduleBody(data: Partial<Task>): Record<string, unknown> {
  if (data.startMinutes != null && data.endMinutes != null) {
    return { time_slot: { start: data.startMinutes, end: data.endMinutes } };
  }
  if (data.shift) {
    return { shift: data.shift };
  }
  throw new Error("Informe um horário ou um turno para a tarefa.");
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
  // `status` não vai no POST: o caso de uso define o inicial (Pendente).
  const wire = await request<TaskWire>("/tasks", {
    method: "POST",
    body: {
      description: data.description,
      category: data.category,
      date: data.date,
      priority: data.priority,
      ...scheduleBody(data),
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

  const data: Record<string, unknown> = { ...rest };
  if (startMinutes != null || endMinutes != null || shift) {
    Object.assign(data, scheduleBody({ startMinutes, endMinutes, shift }));
  }

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
