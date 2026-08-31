import * as goalsApi from "./goalsApi";
import * as tasksApi from "./tasksApi";
import * as remindersApi from "./remindersApi";

// Fachada única das telas. Meta, Tarefa e Lembrete falam com o backend real
// (endpoints em goalsApi / tasksApi / remindersApi). A escolha fica aqui, e
// não nas páginas, para que trocar o transporte seja mudança de um arquivo só.

export const virtualPlannerApi = {
  // --- METAS ---
  getGoals: goalsApi.listGoals,
  getGoalById: goalsApi.getGoalById,
  createGoal: goalsApi.createGoal,
  updateGoal: goalsApi.updateGoal,
  deleteGoal: goalsApi.deleteGoal,

  // --- TAREFAS ---
  getTasks: tasksApi.listTasks,
  getTaskById: tasksApi.getTaskById,
  createTask: tasksApi.createTask,
  updateTask: tasksApi.updateTask,
  deleteTask: tasksApi.deleteTask,

  // --- LEMBRETES ---
  getReminders: remindersApi.listReminders,
  getReminderOccurrences: remindersApi.listReminderOccurrences,
  getReminderById: remindersApi.getReminderById,
  createReminder: remindersApi.createReminder,
  updateReminder: remindersApi.updateReminder,
  deleteReminder: remindersApi.deleteReminder,
};
