import type { Task } from "../../types/domain";
import { request } from "./httpClient";

// Diferente de metas que possuem períodos grandes, tarefas geralmente são
// buscadas por uma data específica ou um intervalo menor.
export async function listTasks(date?: string): Promise<Task[]> {
  const query = date ? { date } : undefined;
  return request<Task[]>("/tasks", { query });
}

export async function getTaskById(id: number): Promise<Task> {
  return request<Task>(`/tasks/${id}`);
}

export async function createTask(data: Omit<Task, "id">): Promise<Task> {
  return request<Task>("/tasks", { method: "POST", body: data });
}

export async function updateTask(
  id: number,
  updates: Partial<Task>,
): Promise<Task> {
  const { status, ...data } = updates;
  let task: Task | undefined;

  if (Object.keys(data).length > 0) {
    task = await request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  // Mantendo o mesmo padrão de rota separada para status, caso o backend de Task exija no futuro.
  if (status !== undefined) {
    task = await request<Task>(`/tasks/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  }

  return task ?? (await getTaskById(id));
}

export async function deleteTask(id: number): Promise<void> {
  await request<void>(`/tasks/${id}`, { method: "DELETE" });
}
