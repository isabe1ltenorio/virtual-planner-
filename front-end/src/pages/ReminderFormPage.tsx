import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router";
import type { Reminder } from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";

export type ReminderFormData = Omit<Reminder, "id">;

// Mesma razao do formulario de tarefa: o id vem da rota, nao do estado.
function toFormData(reminder: Reminder): ReminderFormData {
  return {
    description: reminder.description,
    category: reminder.category,
    date: reminder.date,
    startMinutes: reminder.startMinutes,
    endMinutes: reminder.endMinutes,
    type: reminder.type,
    recurrence: reminder.recurrence,
  };
}

export function ReminderFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const todayStr = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState<ReminderFormData>({
    description: "",
    category: "Study",
    date: todayStr,
    startMinutes: 480,
    endMinutes: 540,
    type: "Meeting",
    recurrence: "Once",
  });

  useEffect(() => {
    if (isEditing && id) {
      virtualPlannerApi
        .getReminders()
        .then((reminders) => {
          const reminderFound = reminders.find((r) => r.id === Number(id));
          if (reminderFound) {
            setFormData(toFormData(reminderFound));
          }
        })
        .catch((err) => console.error("Erro ao carregar lembrete:", err))
        .finally(() => setIsLoading(false));
    }
  }, [id, isEditing]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "startMinutes" || name === "endMinutes"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.date < todayStr) {
      alert("Não é permitido agendar lembretes para datas no passado.");
      return;
    }

    setIsLoading(true);

    try {
      if (isEditing && id) {
        await virtualPlannerApi.updateReminder(Number(id), formData);
      } else {
        await virtualPlannerApi.createReminder(formData);
      }
      navigate("/reminders");
    } catch (error) {
      console.error("Erro ao persistir o lembrete:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-full p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 transition-colors flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-purple-900/30 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {isEditing ? "Editar Lembrete" : "Novo Lembrete"}
        </h1>
        <Link
          to="/reminders"
          className="text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium text-sm"
        >
          Voltar
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-purple-900/30 rounded-2xl p-6 space-y-6 shadow-sm max-w-2xl"
      >
        <div>
          <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
            Descrição do Lembrete
          </label>
          <input
            type="text"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            disabled={isLoading}
            className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
            placeholder="Ex: Reunião de alinhamento com a equipe"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Tipo
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
            >
              <option value="Meeting">Reunião (Meeting)</option>
              <option value="PhoneCall">Ligação (PhoneCall)</option>
              <option value="Shopping">Compras (Shopping)</option>
              <option value="Study">Estudos (Study)</option>
              <option value="Exercise">Exercícios (Exercise)</option>
              <option value="Assignment">
                Entrega de Trabalho (Assignment)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Categoria
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
            >
              <option value="College">Faculdade</option>
              <option value="Work">Trabalho</option>
              <option value="Health">Saúde</option>
              <option value="Leisure">Lazer</option>
              <option value="PersonalProjects">Projetos Pessoais</option>
              <option value="Study">Estudos</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Data
            </label>
            <input
              type="date"
              name="date"
              min={todayStr}
              value={formData.date}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all dark:[color-scheme:dark] disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Início (Minutos)
            </label>
            <input
              type="number"
              name="startMinutes"
              value={formData.startMinutes}
              onChange={handleChange}
              min={0}
              max={1440}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Fim (Minutos)
            </label>
            <input
              type="number"
              name="endMinutes"
              value={formData.endMinutes}
              onChange={handleChange}
              min={0}
              max={1440}
              disabled={isLoading}
              className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
            Recorrência
          </label>
          <select
            name="recurrence"
            value={formData.recurrence}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-purple-900/50 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all disabled:opacity-50"
          >
            <option value="Once">Único (Apenas uma vez)</option>
            <option value="Daily">Diário</option>
            <option value="Weekly">Semanal</option>
            <option value="Monthly">Mensal</option>
          </select>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-purple-900/30 flex justify-end gap-3">
          <Link
            to="/reminders"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-transparent hover:bg-purple-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-600/30 transition-all disabled:opacity-50"
          >
            {isLoading
              ? "Salvando..."
              : isEditing
                ? "Salvar Alterações"
                : "Criar Lembrete"}
          </button>
        </div>
      </form>
    </div>
  );
}
