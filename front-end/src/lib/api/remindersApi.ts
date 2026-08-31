import type { Reminder } from "../../types/domain";
import { request } from "./httpClient";

export async function listReminders(date?: string): Promise<Reminder[]> {
  const query = date ? { date } : undefined;
  return request<Reminder[]>("/reminders", { query });
}

export async function getReminderById(id: number): Promise<Reminder> {
  return request<Reminder>(`/reminders/${id}`);
}

export async function createReminder(
  data: Omit<Reminder, "id">,
): Promise<Reminder> {
  return request<Reminder>("/reminders", { method: "POST", body: data });
}

export async function updateReminder(
  id: number,
  data: Partial<Reminder>,
): Promise<Reminder> {
  return request<Reminder>(`/reminders/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export async function deleteReminder(id: number): Promise<void> {
  await request<void>(`/reminders/${id}`, { method: "DELETE" });
}
