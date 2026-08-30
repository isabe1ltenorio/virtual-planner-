import { useEffect, useState } from "react";
import { Link } from "react-router";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Reminder } from "../types/domain";

export function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>("ALL");

  useEffect(() => {
    async function loadReminders() {
      try {
        const data = await virtualPlannerApi.getReminders();
        setReminders(data);
      } catch (error) {
        console.error("Erro ao buscar lembretes:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadReminders();
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Deseja realmente excluir este lembrete?")) return;
    try {
      await virtualPlannerApi.deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Erro ao deletar lembrete:", error);
    }
  }

  const filteredReminders = reminders.filter((reminder) => {
    return selectedType === "ALL" || reminder.type === selectedType;
  });

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-full transition-colors">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-purple-900/30 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Lembretes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerencie seus avisos e notificações importantes.
          </p>
        </div>
        <Link
          to="/reminders/new"
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-colors shadow-sm"
        >
          + Novo Lembrete
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-purple-900/30 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
            TIPO DE LEMBRETE
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-purple-900/50 text-gray-900 dark:text-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-purple-500 transition-colors"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="Meeting">Meeting</option>
            <option value="PhoneCall">Phone Call</option>
            <option value="Shopping">Shopping</option>
            <option value="Study">Study</option>
            <option value="Exercise">Exercise</option>
            <option value="Assignment">Assignment</option>
          </select>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-purple-900/30 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-purple-600 dark:text-purple-400 animate-pulse font-medium">
            Carregando lembretes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 text-xs text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Data</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                {filteredReminders.map((reminder) => (
                  <tr
                    key={reminder.id}
                    className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-200">
                      {reminder.description}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                        {reminder.type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {reminder.date}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        to={`/reminders/${reminder.id}/edit`}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium text-xs px-2 py-1 bg-purple-50 dark:bg-purple-950/30 rounded border border-purple-200 dark:border-purple-900/50"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(reminder.id)}
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
