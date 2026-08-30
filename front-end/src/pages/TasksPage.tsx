import React, { useEffect, useState } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Category, Task, TaskStatus, Priority } from "../types/domain";
import { getThemeColors, getPriorityColors } from "../utils/badgeStyles";
import {
  CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  PRIORITY_LABELS,
} from "../lib/formatters";

type GroupMode = "category" | "status";
type LayoutMode = "board" | "list";

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("board");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [drawerContext, setDrawerContext] = useState<{
    field: GroupMode;
    value: string;
  } | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setIsLoading(true);
    try {
      const data = await virtualPlannerApi.getTasks();
      setTasks(data);
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Deseja realmente excluir esta tarefa?")) return;
    try {
      await virtualPlannerApi.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (editingTask?.id === id) closeDrawer();
    } catch (error) {
      console.error("Erro ao deletar tarefa:", error);
    }
  }

  async function handleSaveTask(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const titleInput = form.elements.namedItem("taskTitle") as HTMLInputElement;
    const categoryInput = form.elements.namedItem(
      "taskCategory",
    ) as HTMLSelectElement;
    const statusInput = form.elements.namedItem(
      "taskStatus",
    ) as HTMLSelectElement;
    const priorityInput = form.elements.namedItem(
      "taskPriority",
    ) as HTMLSelectElement;

    if (!titleInput || !titleInput.value.trim()) return;

    const finalCategory =
      !editingTask && drawerContext?.field === "category"
        ? drawerContext.value
        : categoryInput?.value || "Work";

    const finalStatus =
      !editingTask && drawerContext?.field === "status"
        ? drawerContext.value
        : statusInput?.value || "Pending";

    const taskData = {
      description: titleInput.value,
      category: finalCategory as Category,
      status: finalStatus as TaskStatus,
      priority: (priorityInput?.value || "Medium") as Priority,
      date: editingTask
        ? editingTask.date
        : new Date().toISOString().split("T")[0],
      startMinutes: editingTask ? editingTask.startMinutes : 480,
      endMinutes: editingTask ? editingTask.endMinutes : 540,
      shift: editingTask ? editingTask.shift : undefined,
    };

    try {
      if (editingTask) {
        if (virtualPlannerApi.updateTask) {
          await virtualPlannerApi.updateTask(editingTask.id, taskData);
        }
      } else {
        await virtualPlannerApi.createTask(taskData as Omit<Task, "id">);
      }
      closeDrawer();
      await loadTasks();
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
    }
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setEditingTask(null);
  }

  const filteredTasks = tasks.filter((task) => {
    const matchStatus =
      selectedStatus === "ALL" || task.status === selectedStatus;
    const matchCategory =
      selectedCategory === "ALL" || task.category === selectedCategory;
    return matchStatus && matchCategory;
  });

  return (
    <div className="w-full min-h-screen p-6 space-y-6 bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 transition-colors flex flex-col">
      {/* CABEÇALHO */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-purple-900/30 pb-4 gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Tarefas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie suas atividades diárias em colunas ou lista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Os dois filtros ja eram lidos em filteredTasks, mas nao havia
              controle nenhum que os mudasse: na pratica ficavam presos em
              "ALL". */}
          <select
            aria-label="Filtrar por status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/50 text-gray-700 dark:text-gray-200 rounded-xl px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="ALL">Todos os status</option>
            {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por categoria"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/50 text-gray-700 dark:text-gray-200 rounded-xl px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="ALL">Todas as categorias</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>

          <div className="bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-purple-900/50 flex items-center gap-1 shadow-sm">
            <button
              onClick={() => setLayoutMode("board")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                layoutMode === "board"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Quadro
            </button>
            <button
              onClick={() => setLayoutMode("list")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                layoutMode === "list"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Lista
            </button>
          </div>

          {layoutMode === "board" && (
            <div className="bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-purple-900/50 flex items-center gap-1 shadow-sm">
              <button
                onClick={() => setGroupMode("category")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  groupMode === "category"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Categoria
              </button>

              <button
                onClick={() => setGroupMode("status")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  groupMode === "status"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Status
              </button>
            </div>
          )}
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      {isLoading ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-purple-900/30 p-8 text-center text-purple-600 dark:text-purple-400 animate-pulse font-medium shadow-sm">
          Carregando tarefas...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-white dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-300 dark:border-purple-900/30 p-12 shadow-sm">
          <p className="text-lg font-medium mb-4">Nenhuma tarefa encontrada.</p>
          <button
            onClick={() => {
              setDrawerContext({
                field: groupMode,
                value: groupMode === "category" ? "Work" : "Pending",
              });
              setIsDrawerOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm"
          >
            Criar primeira tarefa
          </button>
        </div>
      ) : layoutMode === "board" ? (
        /* --- VISÃO EM QUADRO (KANBAN) COM CORES DINÂMICAS POR GRUPOMODE --- */
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar flex-1 items-start w-full">
          {(() => {
            const activeKeys = Array.from(
              new Set(
                filteredTasks.map((t) =>
                  groupMode === "category" ? t.category : t.status,
                ),
              ),
            );
            const columns =
              activeKeys.length > 0
                ? activeKeys
                : [groupMode === "category" ? "Work" : "Pending"];

            return columns.map((colValue) => {
              const colTasks = filteredTasks.filter((t) =>
                groupMode === "category"
                  ? t.category === colValue
                  : t.status === colValue,
              );

              const theme = getThemeColors(colValue);
              const displayTitle =
                groupMode === "category"
                  ? CATEGORY_LABELS[colValue as Category] || colValue
                  : TASK_STATUS_LABELS[colValue as TaskStatus] || colValue;

              return (
                <div
                  key={colValue}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 w-[320px] shrink-0 flex flex-col shadow-sm max-h-full"
                >
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${theme.badge}`}
                    >
                      {displayTitle}
                    </span>
                    <span className="text-xs text-gray-500 font-semibold px-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                    {colTasks.map((task) => {
                      // O card acompanha estritamente a cor do grupo ativo (Categoria ou Status)[cite: 1]
                      const cardTheme = getThemeColors(
                        groupMode === "category" ? task.category : task.status,
                      );
                      const secondaryValue =
                        groupMode === "category" ? task.status : task.category;
                      const secondaryTheme = getThemeColors(secondaryValue);
                      const secondaryLabel =
                        groupMode === "category"
                          ? TASK_STATUS_LABELS[task.status as TaskStatus] ||
                            task.status
                          : CATEGORY_LABELS[task.category as Category] ||
                            task.category;

                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            setEditingTask(task);
                            setDrawerContext(null);
                            setIsDrawerOpen(true);
                          }}
                          className={`${cardTheme.cardBg} border ${cardTheme.border} hover:shadow-md rounded-xl p-4 transition-all group space-y-3 cursor-pointer`}
                        >
                          <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 leading-snug">
                            {task.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${secondaryTheme.badge}`}
                            >
                              {secondaryLabel}
                            </span>

                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${getPriorityColors(task.priority)}`}
                            >
                              {PRIORITY_LABELS[task.priority as Priority] ||
                                task.priority}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setEditingTask(null);
                      setDrawerContext({ field: groupMode, value: colValue });
                      setIsDrawerOpen(true);
                    }}
                    className={`mt-4 w-full py-2.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-gray-700 ${theme.text}`}
                  >
                    <span className="text-lg leading-none">+</span> Novo(a) item
                  </button>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* --- VISÃO EM LISTA (TABELA) --- */
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Prioridade</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td
                      className="p-4 font-semibold text-slate-900 dark:text-gray-100 cursor-pointer"
                      onClick={() => {
                        setEditingTask(task);
                        setIsDrawerOpen(true);
                      }}
                    >
                      {task.description}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getThemeColors(task.category).badge}`}
                      >
                        {CATEGORY_LABELS[task.category as Category] ||
                          task.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getThemeColors(task.status).badge}`}
                      >
                        {TASK_STATUS_LABELS[task.status as TaskStatus] ||
                          task.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityColors(task.priority)}`}
                      >
                        {PRIORITY_LABELS[task.priority as Priority] ||
                          task.priority}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium text-xs px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50 transition-colors"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PAINEL LATERAL (DRAWER) --- */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-purple-900/40 h-full p-6 flex flex-col shadow-2xl animate-slide-in-right">
            <div className="flex items-center justify-end pb-2">
              <button
                onClick={closeDrawer}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-bold px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveTask}
              className="space-y-6 flex-1 flex flex-col"
            >
              <input
                name="taskTitle"
                type="text"
                autoFocus
                defaultValue={editingTask?.description || ""}
                placeholder="Nome da tarefa..."
                className="w-full bg-transparent text-xl font-bold text-slate-900 dark:text-gray-100 placeholder-gray-400 border-b border-gray-200 dark:border-gray-800 focus:border-purple-600 focus:outline-none pb-3 mb-2 transition-colors"
              />

              <div className="space-y-5 text-sm pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between group">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2 font-medium">
                    🗂️ Categoria
                  </span>
                  {!editingTask && drawerContext?.field === "category" ? (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getThemeColors(drawerContext.value).badge}`}
                    >
                      {CATEGORY_LABELS[drawerContext.value as Category] ||
                        drawerContext.value}
                    </span>
                  ) : (
                    <select
                      name="taskCategory"
                      defaultValue={editingTask?.category || "Work"}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-600 cursor-pointer outline-none font-semibold text-slate-900 dark:text-gray-200 transition-colors"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center justify-between group">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2 font-medium">
                    🔆 Status
                  </span>
                  {!editingTask && drawerContext?.field === "status" ? (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getThemeColors(drawerContext.value).badge}`}
                    >
                      {TASK_STATUS_LABELS[drawerContext.value as TaskStatus] ||
                        drawerContext.value}
                    </span>
                  ) : (
                    <select
                      name="taskStatus"
                      defaultValue={editingTask?.status || "Pending"}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-600 cursor-pointer outline-none font-semibold text-slate-900 dark:text-gray-200 transition-colors"
                    >
                      {Object.entries(TASK_STATUS_LABELS).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                </div>

                <div className="flex items-center justify-between group">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2 font-medium">
                    ⏫ Prioridade
                  </span>
                  <select
                    name="taskPriority"
                    defaultValue={editingTask?.priority || "Medium"}
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-purple-600 cursor-pointer outline-none font-semibold text-slate-900 dark:text-gray-200 transition-colors"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-md shadow-purple-600/30"
                  >
                    {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
                  </button>
                </div>
                {editingTask && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingTask.id)}
                    className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Excluir Tarefa
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
