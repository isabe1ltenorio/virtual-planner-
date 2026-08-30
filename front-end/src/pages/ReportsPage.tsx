import { useEffect, useState, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Task, Goal } from "../types/domain";
import { calculateReportStats } from "../utils/reportCalculator";

type FilterPeriod = "Semana" | "Mês" | "Ano";

export function ReportsPage() {
  const [filterType, setFilterType] = useState<FilterPeriod>("Semana");
  const [isLoading, setIsLoading] = useState(true);

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawGoals, setRawGoals] = useState<Goal[]>([]);

  // Busca os dados da API apenas na montagem da página
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [tasksData, goalsData] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getGoals(),
        ]);

        if (isMounted) {
          setRawTasks(tasksData);
          setRawGoals(goalsData);
        }
      } catch (error) {
        console.error("Erro ao carregar dados do relatório:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtra as tarefas e metas com base no período selecionado (Semana/Mês/Ano)
  const { filteredTasks, filteredGoals } = useMemo(() => {
    const today = new Date();
    let start: Date, end: Date;

    switch (filterType) {
      case "Semana":
        start = startOfWeek(today, { weekStartsOn: 1 }); // Segunda-feira
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "Mês":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case "Ano":
        start = startOfYear(today);
        end = endOfYear(today);
        break;
    }

    const tasks = rawTasks.filter((t) => {
      if (!t.date) return false;
      const taskDate = parseISO(t.date);
      return isWithinInterval(taskDate, { start, end });
    });

    const goals = rawGoals.filter((g) => {
      if (filterType === "Semana") return g.period === "Weekly";
      if (filterType === "Mês") return g.period === "Monthly";
      if (filterType === "Ano") return g.period === "Yearly";
      return true;
    });

    return { filteredTasks: tasks, filteredGoals: goals };
  }, [rawTasks, rawGoals, filterType]);

  // Recalcula o objeto de estatísticas sempre que o filtro muda
  const stats = useMemo(
    () => calculateReportStats(filteredTasks, filteredGoals),
    [filteredTasks, filteredGoals],
  );

  const periods: FilterPeriod[] = ["Semana", "Mês", "Ano"];

  return (
    <div className="w-full min-h-full p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 transition-colors flex flex-col">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-purple-900/30 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Painel Analítico & Relatórios
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Estatísticas filtradas por {filterType.toLowerCase()} para análise
            de produtividade.
          </p>
        </div>

        {/* Botões de Filtro */}
        <div className="flex bg-white dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setFilterType(period)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filterType === period
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="text-center py-20 text-purple-600 dark:text-purple-400 animate-pulse font-medium">
          Filtrando métricas para {filterType}...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Taxas de Conclusão */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-6 flex flex-col justify-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-gray-100 mb-6">
              Taxa de Conclusão ({filterType})
            </h2>

            <div className="space-y-6">
              {/* Progresso de Metas */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    Metas Cumpridas
                  </span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {stats.goals.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-600 h-3 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${stats.goals.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.goals.completed} de {stats.goals.total} metas
                  alcançadas neste período
                </p>
              </div>

              {/* Progresso de Tarefas */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    Tarefas Executadas
                  </span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {stats.tasks.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${stats.tasks.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.tasks.completed} de {stats.tasks.total} tarefas
                  executadas neste período
                </p>
              </div>
            </div>
          </div>

          {/* Bento Grid (Destaques) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Turno Produtivo ({filterType})
              </span>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white block">
                  {stats.bestShift}
                </span>
                <span className="text-sm text-purple-600 dark:text-purple-400">
                  Maior foco registrado
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pico de Entregas
              </span>
              <div className="mt-4">
                <span className="text-lg font-bold text-slate-900 dark:text-white block truncate">
                  {stats.bestPeriod}
                </span>
                <span className="text-sm text-purple-600 dark:text-purple-400">
                  Melhor dia do período
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Top Categoria (Tarefas)
              </span>
              <div className="mt-4">
                <span className="text-lg font-bold text-slate-900 dark:text-white block truncate">
                  {stats.topTaskCategory}
                </span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400">
                  Mais executada
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Top Categoria (Metas)
              </span>
              <div className="mt-4">
                <span className="text-lg font-bold text-slate-900 dark:text-white block truncate">
                  {stats.topGoalCategory}
                </span>
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  Mais cumprida
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
