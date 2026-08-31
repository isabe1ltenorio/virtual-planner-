import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportMetrics } from "../lib/api/reportingApi";
import { DashboardPage } from "./DashboardPage";

const EMPTY_REPORT: ReportMetrics = {
  start_date: "2026-08-17",
  end_date: "2026-08-17",
  goals_total: 0,
  goals_completed: 0,
  goals_partially_completed: 0,
  goals_ratio: null,
  tasks_total: 0,
  tasks_executed: 0,
  tasks_partially_executed: 0,
  tasks_ratio: null,
  most_productive_weeks: [],
  most_productive_months: [],
  most_productive_shifts: [],
  task_categories: [],
  goal_categories: [],
  productivity_index: null,
};

const TASK_RESPONSE = {
  id: 43,
  description: "Tarefa de hoje",
  category: "Study",
  date: "2026-08-17",
  time_slot: { start: 540, end: 660 },
  shift: "Morning",
  scheduled_by_shift: false,
  priority: "High",
  status: "Pending",
};

const OCCURRENCE_RESPONSE = {
  reminder: {
    id: 44,
    description: "Revisão semanal",
    category: "Study",
    date: "2020-06-15",
    time_slot: { start: 660, end: 690 },
    type: "Study",
    recurrence: "Weekly",
  },
  occurrence_date: "2026-08-17",
};

function apiResponse(
  input: RequestInfo | URL,
  report = EMPTY_REPORT,
  tasks: (typeof TASK_RESPONSE)[] = [],
  occurrences: (typeof OCCURRENCE_RESPONSE)[] = [],
): Response {
  const path = new URL(String(input), "http://localhost").pathname;
  if (path === "/api/dashboard") return Response.json(report);
  if (path === "/api/tasks") return Response.json(tasks);
  if (path === "/api/goals") return Response.json([]);
  if (path === "/api/reminders") return Response.json(occurrences);
  throw new Error(`Requisição inesperada no teste: ${path}`);
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-17T12:00:00Z"));
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { index: null, expected: "Sem dados" },
    { index: 0, expected: "0%" },
  ])(
    "distingue produtividade $expected na resposta da API",
    async ({ index, expected }) => {
      const report = { ...EMPTY_REPORT, productivity_index: index };
      fetchMock.mockImplementation(async (input) => apiResponse(input, report));

      renderDashboard();

      const label = await screen.findByText("Índice de produtividade de hoje");
      expect(label.parentElement).toHaveTextContent(expected);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dashboard",
        expect.objectContaining({ method: "GET", credentials: "include" }),
      );
    },
  );

  it("usa métricas e rankings do backend sem ligá-los ao dia selecionado na agenda", async () => {
    const user = userEvent.setup();
    const report: ReportMetrics = {
      ...EMPTY_REPORT,
      tasks_total: 8,
      tasks_executed: 6,
      tasks_ratio: 0.75,
      productivity_index: 0.75,
      task_categories: [{ label: "Study", total: 8, score: 6, ratio: 0.75 }],
      most_productive_shifts: [
        { label: "Morning", total: 8, score: 6, ratio: 0.75 },
      ],
    };
    fetchMock.mockImplementation(async (input) =>
      apiResponse(input, report, [], [OCCURRENCE_RESPONSE]),
    );
    renderDashboard();
    const label = await screen.findByText("Índice de produtividade de hoje");
    expect(label.parentElement).toHaveTextContent("75%");
    const categories = screen.getByRole("table", {
      name: "Categorias de tarefas — hoje",
    });
    expect(within(categories).getByRole("cell", { name: "8" })).toBeVisible();
    expect(
      within(categories).getByRole("rowheader", { name: "Estudos" }),
    ).toBeVisible();
    expect(
      await screen.findByRole("link", {
        name: "11:00–11:30 Lembrete: Revisão semanal",
      }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "18" }));

    expect(
      screen.getByRole("heading", { name: "Agenda de 18 de agosto" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole("link", {
          name: "11:00–11:30 Lembrete: Revisão semanal",
        }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("heading", { name: "Indicadores de hoje" }),
    ).toBeVisible();
    expect(label.parentElement).toHaveTextContent("75%");
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/dashboard"),
    ).toHaveLength(1);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/reminders") {
        expect(url.searchParams.has("start_date")).toBe(true);
        expect(url.searchParams.has("end_date")).toBe(true);
      }
    }
  });

  it("recarrega as métricas do backend depois de mudar o status da tarefa", async () => {
    const user = userEvent.setup();
    let executed = false;
    fetchMock.mockImplementation(async (input, options) => {
      if (input === "/api/tasks/43/status" && options?.method === "PATCH") {
        executed = true;
        return Response.json({ ...TASK_RESPONSE, status: "Executed" });
      }
      return apiResponse(
        input,
        {
          ...EMPTY_REPORT,
          tasks_total: 1,
          tasks_executed: executed ? 1 : 0,
          tasks_ratio: executed ? 1 : 0,
          productivity_index: executed ? 1 : 0,
        },
        [{ ...TASK_RESPONSE, status: executed ? "Executed" : "Pending" }],
      );
    });
    renderDashboard();
    await screen.findByRole("button", { name: "Pendente" });

    await user.click(screen.getByRole("button", { name: "Pendente" }));
    await user.click(screen.getByRole("option", { name: "Executada" }));

    await waitFor(() =>
      expect(
        screen.getByText("Índice de produtividade de hoje").parentElement,
      ).toHaveTextContent("100%"),
    );
    expect(
      await screen.findByRole("button", { name: "Executada" }),
    ).toBeEnabled();
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/dashboard"),
    ).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tasks/43/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Executed" }),
      }),
    );
  });

  it("mostra falha de mudança de status sem apresentar sucesso ou mudar a tarefa", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, options) => {
      if (input === "/api/tasks/43/status" && options?.method === "PATCH") {
        return Response.json(
          {
            error: {
              code: "internal_error",
              message: "Falha ao atualizar tarefa.",
            },
          },
          { status: 500 },
        );
      }
      return apiResponse(input, EMPTY_REPORT, [TASK_RESPONSE]);
    });
    renderDashboard();
    await screen.findByRole("button", { name: "Pendente" });

    await user.click(screen.getByRole("button", { name: "Pendente" }));
    await user.click(screen.getByRole("option", { name: "Executada" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao atualizar tarefa.",
    );
    expect(screen.getByRole("button", { name: "Pendente" })).toBeEnabled();
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/dashboard"),
    ).toHaveLength(1);
  });

  it("exibe erro e permite recarregar indicadores sem inventar métricas vazias", async () => {
    const user = userEvent.setup();
    let unavailable = true;
    fetchMock.mockImplementation(async (input) => {
      if (input === "/api/dashboard" && unavailable) {
        return Response.json(
          {
            error: {
              code: "internal_error",
              message: "Indicadores indisponíveis.",
            },
          },
          { status: 503 },
        );
      }
      return apiResponse(input);
    });
    renderDashboard();
    expect(screen.getByText("Carregando indicadores…")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Indicadores indisponíveis.",
    );
    expect(screen.queryByText("Índice de produtividade de hoje")).toBeNull();
    unavailable = false;

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      (await screen.findByText("Índice de produtividade de hoje"))
        .parentElement,
    ).toHaveTextContent("Sem dados");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input]) => input === "/api/dashboard"),
    ).toHaveLength(2);
  });
});
