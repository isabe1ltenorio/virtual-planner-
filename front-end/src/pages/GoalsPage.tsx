import { useEffect, useState } from "react";
import { Link } from "react-router";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Goal } from "../types/domain";

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  useEffect(() => {
    async function loadGoals() {
      try {
        const data = await virtualPlannerApi.getGoals();
        setGoals(data);
      } catch (error) {
        console.error("Erro ao buscar metas:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadGoals();
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Deseja realmente excluir esta meta?")) return;

    try {
      await virtualPlannerApi.deleteGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (error) {
      console.error("Erro ao deletar meta:", error);
    }
  }

  const filteredGoals = goals.filter((goal) => {
    const matchPeriod =
      selectedPeriod === "ALL" || goal.period === selectedPeriod;
    const matchStatus =
      selectedStatus === "ALL" || goal.status === selectedStatus;
    return matchPeriod && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-full transition-colors">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-purple-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Metas e Objetivos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acompanhe seu progresso semanal, mensal e anual.
          </p>
        </div>

        <Link
          to="/goals/new"
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          + Nova Meta
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-purple-900/30 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
            PERÍODO
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-purple-900/50 text-gray-900 dark:text-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="ALL">Todos os Períodos</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
            STATUS
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-purple-900/50 text-gray-900 dark:text-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="ALL">Todos os Status</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Partially Completed">Partially Completed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-purple-900/30 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-purple-600 dark:text-purple-400 animate-pulse font-medium">
            Carregando metas...
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">
            Nenhuma meta encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Período</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {filteredGoals.map((goal) => (
                  <tr
                    key={goal.id}
                    className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-200">
                      {goal.description}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {goal.category}
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                        {goal.period === "Weekly"
                          ? "Semanal"
                          : goal.period === "Monthly"
                            ? "Mensal"
                            : "Anual"}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          goal.status === "Completed"
                            ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/40"
                            : goal.status === "Failed"
                              ? "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/40"
                              : goal.status === "Partially Completed"
                                ? "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950/40"
                                : "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40"
                        }`}
                      >
                        {goal.status}
                      </span>
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <Link
                        to={`/goals/${goal.id}/edit`}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium text-xs px-2 py-1 bg-purple-50 dark:bg-purple-950/30 rounded border border-purple-200 dark:border-purple-900/50"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium text-xs px-2 py-1 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-900/50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
