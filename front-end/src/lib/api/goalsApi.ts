// Endpoints reais de `Goal`.

import type { Goal } from "../../types/domain";
import { formatDateForInput } from "../formatters";
import { request } from "./httpClient";

export type GoalPeriodFilter = "weekly" | "monthly" | "yearly";

export interface GoalWindow {
  period: GoalPeriodFilter;
  date: string;
}

// A API não tem "listar tudo": `GET /api/goals` exige `period` e `date`, e
// devolve o intervalo civil correspondente. As telas de hoje chamam
// `getGoals()` sem argumento, então o padrão precisa ser largo o bastante para
// não parecer que sumiram metas — o ano corrente cobre o uso real.
//
// Não é "todas as metas": uma meta de 2025 não aparece. Quando alguma tela
// precisar de outro recorte, passa a janela explicitamente.
const defaultWindow: GoalWindow = {
  period: "yearly",
  date: formatDateForInput(),
};

export async function listGoals(
  window: GoalWindow = defaultWindow,
): Promise<Goal[]> {
  return request<Goal[]>("/goals", {
    query: { period: window.period, date: window.date },
  });
}

export async function getGoalById(id: number): Promise<Goal> {
  return request<Goal>(`/goals/${id}`);
}

export async function createGoal(data: Omit<Goal, "id">): Promise<Goal> {
  // `status` não vai no POST: o caso de uso de criação define o inicial.
  const payload = {
    description: data.description,
    category: data.category,
    period: data.period,
    reference_date: data.reference_date,
  };

  return request<Goal>("/goals", { method: "POST", body: payload });
}

export async function updateGoal(
  id: number,
  updates: Partial<Goal>,
): Promise<Goal> {
  const { status, ...data } = updates;

  let goal: Goal | undefined;

  // O backend separa os dois: `PATCH /api/goals/:id` muda os dados e
  // `PATCH /api/goals/:id/status` muda o status. A tela manda o formulário
  // inteiro num objeto só, então dividimos aqui em vez de espalhar a regra
  // pelas páginas.
  if (Object.keys(data).length > 0) {
    goal = await request<Goal>(`/goals/${id}`, {
      method: "PATCH",
      body: data,
    });
  }

  if (status !== undefined) {
    goal = await request<Goal>(`/goals/${id}/status`, {
      method: "PATCH",
      body: { status },
    });
  }

  // Só acontece se `updates` vier vazio; devolver o estado atual é mais útil
  // que devolver undefined e obrigar a tela a tratar.
  return goal ?? (await getGoalById(id));
}

export async function deleteGoal(id: number): Promise<void> {
  await request<void>(`/goals/${id}`, { method: "DELETE" });
}
