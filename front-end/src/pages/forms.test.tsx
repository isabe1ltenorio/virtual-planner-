import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Goal } from "../types/domain";
import { GoalFormPage } from "./GoalFormPage";
import { ReminderFormPage } from "./ReminderFormPage";
import { TaskFormPage } from "./TaskFormPage";

const HISTORICAL_GOAL: Goal = {
  id: 42,
  description: "Meta de um ano anterior",
  category: "Study",
  status: "In Progress",
  period: "Yearly",
  reference_date: "2020-06-15",
};

const TASK_RESPONSE = {
  id: 43,
  description: "Tarefa existente",
  category: "Work",
  date: "2099-01-15",
  time_slot: { start: 540, end: 600 },
  shift: "Morning",
  scheduled_by_shift: false,
  priority: "High",
  status: "Pending",
};

const RECURRING_REMINDER_RESPONSE = {
  id: 44,
  description: "Lembrete recorrente antigo",
  category: "Study",
  date: "2020-06-15",
  time_slot: { start: 660, end: 690 },
  type: "Study",
  recurrence: "Daily",
};

function renderForms(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/goals/new" element={<GoalFormPage />} />
        <Route path="/goals/:id/edit" element={<GoalFormPage />} />
        <Route path="/goals" element={<h1>Lista de metas</h1>} />
        <Route path="/tasks/new" element={<TaskFormPage />} />
        <Route path="/tasks/:id/edit" element={<TaskFormPage />} />
        <Route path="/tasks" element={<h1>Lista de tarefas</h1>} />
        <Route path="/reminders/new" element={<ReminderFormPage />} />
        <Route path="/reminders/:id/edit" element={<ReminderFormPage />} />
        <Route path="/reminders" element={<h1>Lista de lembretes</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("formulários com a API", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  function requestBody(index: number): unknown {
    const body = fetchMock.mock.calls[index]?.[1]?.body;
    if (typeof body !== "string") {
      throw new Error("A requisição deveria conter um corpo JSON.");
    }
    return JSON.parse(body);
  }

  it("edita uma meta histórica por id mesmo fora da listagem do ano atual", async () => {
    const user = userEvent.setup();
    const updatedGoal = {
      ...HISTORICAL_GOAL,
      description: "Meta histórica atualizada",
      status: "Completed",
    };
    fetchMock.mockImplementation(async (input, options) => {
      if (String(input).startsWith("/api/goals?")) return Response.json([]);
      return Response.json(
        options?.method === "GET" ? HISTORICAL_GOAL : updatedGoal,
      );
    });
    renderForms("/goals/42/edit");
    const description = await screen.findByLabelText("Descrição");
    expect(description).toHaveValue(HISTORICAL_GOAL.description);
    expect(screen.getByLabelText("Data de referência")).toHaveValue(
      HISTORICAL_GOAL.reference_date,
    );

    await user.clear(description);
    await user.type(description, updatedGoal.description);
    await user.selectOptions(screen.getByLabelText("Status"), "Completed");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByRole("heading", { name: "Lista de metas" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/goals/42",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/goals/42",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(requestBody(1)).toEqual({
      description: updatedGoal.description,
      category: HISTORICAL_GOAL.category,
      period: HISTORICAL_GOAL.period,
      reference_date: HISTORICAL_GOAL.reference_date,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/goals/42/status",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(requestBody(2)).toEqual({ status: "Completed" });
  });

  it.each([
    {
      route: "/goals/42/edit",
      endpoint: "/api/goals/42",
      loading: "Carregando meta…",
      record: HISTORICAL_GOAL,
    },
    {
      route: "/tasks/43/edit",
      endpoint: "/api/tasks/43",
      loading: "Carregando tarefa…",
      record: TASK_RESPONSE,
    },
    {
      route: "/reminders/44/edit",
      endpoint: "/api/reminders/44",
      loading: "Carregando lembrete…",
      record: RECURRING_REMINDER_RESPONSE,
    },
  ])(
    "bloqueia envio durante carga e erro 404, permitindo tentar novamente em $route",
    async ({ route, endpoint, loading, record }) => {
      const user = userEvent.setup();
      fetchMock
        .mockResolvedValueOnce(
          Response.json(
            {
              error: { code: "not_found", message: "Registro não encontrado." },
            },
            { status: 404 },
          ),
        )
        .mockResolvedValueOnce(Response.json(record));
      renderForms(route);
      expect(screen.getByRole("status")).toHaveTextContent(loading);
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Salvar alterações" }),
      ).toBeNull();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Registro não encontrado.",
      );
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(
        screen.queryByRole("button", { name: "Salvar alterações" }),
      ).toBeNull();

      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );

      expect(await screen.findByLabelText("Descrição")).toHaveValue(
        record.description,
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Salvar alterações" }),
      ).toBeEnabled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const [input, options] of fetchMock.mock.calls) {
        expect(input).toBe(endpoint);
        expect(options?.method).toBe("GET");
      }
    },
  );

  it("cria tarefa por horário sem oferecer status arbitrário nem enviá-lo ao backend", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      Response.json(TASK_RESPONSE, { status: 201 }),
    );
    renderForms("/tasks/new?date=2099-01-15&start=540");
    const description = await screen.findByLabelText("Descrição");
    expect(screen.queryByLabelText("Status")).toBeNull();
    expect(screen.getByLabelText("Início")).toHaveValue("09:00");
    expect(screen.getByLabelText(/^Fim/)).toHaveValue("10:00");

    await user.type(description, "Nova tarefa por horário");
    await user.selectOptions(screen.getByLabelText("Categoria"), "Work");
    await user.selectOptions(screen.getByLabelText("Prioridade"), "High");
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(
      await screen.findByRole("heading", { name: "Lista de tarefas" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/tasks",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(requestBody(0)).toEqual({
      description: "Nova tarefa por horário",
      category: "Work",
      date: "2099-01-15",
      priority: "High",
      time_slot: { start: 540, end: 600 },
    });
  });

  it("envia somente o turno ao criar tarefa com agendamento por turno", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          ...TASK_RESPONSE,
          time_slot: { start: 720, end: 1080 },
          shift: "Afternoon",
          scheduled_by_shift: true,
        },
        { status: 201 },
      ),
    );
    renderForms("/tasks/new?date=2099-01-15");
    const description = await screen.findByLabelText("Descrição");

    await user.type(description, "Nova tarefa por turno");
    await user.selectOptions(screen.getByLabelText("Agendamento"), "shift");
    await user.selectOptions(
      screen.getByLabelText("Turno do dia"),
      "Afternoon",
    );
    await user.click(screen.getByRole("button", { name: "Criar tarefa" }));

    expect(
      await screen.findByRole("heading", { name: "Lista de tarefas" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestBody(0)).toEqual({
      description: "Nova tarefa por turno",
      category: "Study",
      date: "2099-01-15",
      priority: "Medium",
      shift: "Afternoon",
    });
  });

  it("edita lembrete recorrente com data-base passada e preserva a âncora no PUT", async () => {
    const user = userEvent.setup();
    const updatedReminder = {
      ...RECURRING_REMINDER_RESPONSE,
      description: "Recorrência atualizada",
      recurrence: "Weekly",
    };
    fetchMock
      .mockResolvedValueOnce(Response.json(RECURRING_REMINDER_RESPONSE))
      .mockResolvedValueOnce(Response.json(updatedReminder));
    renderForms("/reminders/44/edit");
    const description = await screen.findByLabelText("Descrição");
    expect(screen.getByLabelText("Data-base")).toHaveValue("2020-06-15");
    expect(screen.getByLabelText("Data-base")).not.toHaveAttribute("min");

    await user.clear(description);
    await user.type(description, updatedReminder.description);
    await user.selectOptions(screen.getByLabelText("Recorrência"), "Weekly");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByRole("heading", { name: "Lista de lembretes" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/reminders/44",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(requestBody(1)).toEqual({
      description: "Recorrência atualizada",
      category: "Study",
      date: "2020-06-15",
      time_slot: { start: 660, end: 690 },
      type: "Study",
      recurrence: "Weekly",
    });
  });
});
