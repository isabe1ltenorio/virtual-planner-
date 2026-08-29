import type { Task, Goal, Reminder } from "../../types/domain";
import { mockTasks, mockGoals, mockReminders } from "../../mocks/seed";
import { isApiEnabled } from "./config";
import * as goalsApi from "./goalsApi";

// Fachada única das telas. Os métodos de `Goal` falam com o backend quando
// `VITE_API_URL` está definida, e caem nos mocks quando não está.
//
// `Task` e `Reminder` seguem só em mock: não existem endpoints para eles ainda.
// A escolha fica aqui, e não nas páginas, para que ligar o resto no futuro seja
// mudança de um arquivo só.

//simula tempo de resposta da internet
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

//simula o banco de dados rodando
let currentTasks = [...mockTasks];
let currentGoals = [...mockGoals];
let currentReminders = [...mockReminders];

export const virtualPlannerApi = {
  async getTasks(): Promise<Task[]> {
    await delay(500);
    return [...currentTasks];
  },

  //Adiciona nova tarefa
  async createTask(newTaskData: Omit<Task, "id">): Promise<Task> {
    await delay(600);

    //gera um novo Id
    const newId =
      currentTasks.length > 0
        ? Math.max(...currentTasks.map((t) => t.id)) + 1
        : 1;

    // cria a tarefa com Id + dados recebidos
    const taskToSave: Task = {
      id: newId,
      ...newTaskData,
    };

    currentTasks.push(taskToSave);
    return taskToSave;
  },

  async updateTask(id: number, updates: Partial<Task>): Promise<Task> {
    await delay(400);

    // Busca qual a posição (índice) da tarefa na nossa lista
    const index = currentTasks.findIndex((t) => t.id === id);

    // Se não achou (index for -1), joga um erro
    if (index === -1) {
      throw new Error(`Tarefa com ID ${id} não encontrada.`);
    }

    // Pega a tarefa antiga e substitui apenas os campos novos que chegaram
    const updatedTask: Task = { ...currentTasks[index], ...updates };

    if (updates.shift !== undefined) {
      delete updatedTask.startMinutes;
      delete updatedTask.endMinutes;
    } else if (
      updates.startMinutes !== undefined ||
      updates.endMinutes !== undefined
    ) {
      delete updatedTask.shift;
    }

    currentTasks[index] = updatedTask;
    return updatedTask;
  },

  async deleteTask(id: number): Promise<void> {
    await delay(300);

    // altera a lista mantendo apenas as do id deferente que queremos remover.
    currentTasks = currentTasks.filter((t) => t.id !== id);
  },

  // Metodos de Metas
  async getGoals(): Promise<Goal[]> {
    if (isApiEnabled()) {
      return goalsApi.listGoals();
    }

    await delay(500);
    return [...currentGoals];
  },

  async createGoal(newGoalData: Omit<Goal, "id">): Promise<Goal> {
    if (isApiEnabled()) {
      return goalsApi.createGoal(newGoalData);
    }

    await delay(600);
    const newId =
      currentGoals.length > 0
        ? Math.max(...currentGoals.map((g) => g.id)) + 1
        : 1;

    const goalToSave: Goal = { id: newId, ...newGoalData };
    currentGoals.push(goalToSave);
    return goalToSave;
  },

  async updateGoal(id: number, updates: Partial<Goal>): Promise<Goal> {
    if (isApiEnabled()) {
      return goalsApi.updateGoal(id, updates);
    }

    await delay(400);
    const index = currentGoals.findIndex((g) => g.id === id);
    if (index === -1) throw new Error(`Meta com ID ${id} não encontrada.`);

    const updatedGoal = { ...currentGoals[index], ...updates };
    currentGoals[index] = updatedGoal;
    return updatedGoal;
  },

  async deleteGoal(id: number): Promise<void> {
    if (isApiEnabled()) {
      return goalsApi.deleteGoal(id);
    }

    await delay(300);
    currentGoals = currentGoals.filter((g) => g.id !== id);
  },

  //Metodos de Lembretes
  async getReminders(): Promise<Reminder[]> {
    await delay(500);
    return [...currentReminders];
  },

  async createReminder(
    newReminderData: Omit<Reminder, "id">,
  ): Promise<Reminder> {
    await delay(600);
    const newId =
      currentReminders.length > 0
        ? Math.max(...currentReminders.map((r) => r.id)) + 1
        : 1;

    const reminderToSave: Reminder = { id: newId, ...newReminderData };
    currentReminders.push(reminderToSave);
    return reminderToSave;
  },

  async updateReminder(
    id: number,
    updates: Partial<Reminder>,
  ): Promise<Reminder> {
    await delay(400);
    const index = currentReminders.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Lembrete com ID ${id} não encontrado.`);

    const updatedReminder = { ...currentReminders[index], ...updates };
    currentReminders[index] = updatedReminder;
    return updatedReminder;
  },

  async deleteReminder(id: number): Promise<void> {
    await delay(300);
    currentReminders = currentReminders.filter((r) => r.id !== id);
  },

  async getTaskById(id: number): Promise<Task | null> {
    await delay(300);
    const task = currentTasks.find((t) => t.id === id);
    return task ? { ...task } : null;
  },
};
