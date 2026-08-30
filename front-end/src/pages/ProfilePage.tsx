import { useState, useEffect } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";

const STORAGE_KEY = "@VP:user";

const DEFAULT_USER = {
  id: 1,
  name: "Desenvolvedor Backend",
  email: "dev@academico.br",
};

// Lido uma vez, na inicializacao do estado. Ler dentro do efeito e chamar
// setUser fazia a tela renderizar vazia antes de renderizar preenchida, de
// graca. `localStorage` tambem pode lancar (janela anonima, site data
// bloqueado), e ai o padrao vale.
function storedUser(): typeof DEFAULT_USER {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? DEFAULT_USER : JSON.parse(saved);
  } catch {
    return DEFAULT_USER;
  }
}

export function ProfilePage() {
  const [user, setUser] = useState(storedUser);
  const [isEditing, setIsEditing] = useState(false);
  const [stats, setStats] = useState({ tasks: 0, goals: 0, reminders: 0 });

  useEffect(() => {
    // Primeira visita: grava o padrao para que a proxima leitura ja o encontre.
    try {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USER));
      }
    } catch {
      // Sem armazenamento a tela continua funcionando, so nao lembra a edicao.
    }

    // Carrega métricas para preencher e enriquecer a tela
    async function loadStats() {
      try {
        const [tasks, goals, reminders] = await Promise.all([
          virtualPlannerApi.getTasks(),
          virtualPlannerApi.getGoals(),
          virtualPlannerApi.getReminders(),
        ]);
        setStats({
          tasks: tasks.length,
          goals: goals.length,
          reminders: reminders.length,
        });
      } catch (error) {
        console.error("Erro ao carregar estatísticas do perfil:", error);
      }
    }
    loadStats();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setIsEditing(false);
  };

  return (
    <div className="w-full min-h-full p-6 md:p-8 space-y-8 bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 transition-colors flex flex-col">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-purple-900/30 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Perfil do Usuário
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie suas informações pessoais e visualize estatísticas gerais
            da conta.
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cartão Esquerdo: Avatar e Dados de Identificação */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-purple-900/30 shadow-sm flex flex-col justify-between space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-28 h-28 rounded-full bg-purple-600 flex items-center justify-center text-5xl font-bold text-white shadow-xl shadow-purple-600/30 uppercase">
              {user.name ? user.name.charAt(0) : "U"}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                {user.name || "Usuário"}
              </h2>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                {user.email}
              </p>
              <span className="inline-block mt-3 px-3 py-1 bg-purple-50 dark:bg-purple-950/40 text-xs font-semibold text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-900/50">
                ID de Usuário: #{user.id}
              </span>
            </div>
          </div>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-md shadow-purple-600/30 transition-all text-sm"
            >
              Editar Dados Pessoais
            </button>
          )}
        </div>

        {/* Área Direita: Formulário de Edição ou Visão de Métricas */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-purple-900/30 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                Editar Informações
              </h3>
              <form onSubmit={handleSave} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 uppercase tracking-wider">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={user.name}
                    onChange={(e) => setUser({ ...user, name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-purple-900/50 bg-gray-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 uppercase tracking-wider">
                    E-mail de Contato
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    onChange={(e) =>
                      setUser({ ...user, email: e.target.value })
                    }
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-purple-900/50 bg-gray-50 dark:bg-gray-950 text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all font-medium"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-purple-600/30 transition-all"
                  >
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              {/* Cartão de Visão Geral / Estatísticas */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-purple-900/30 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  Visão Geral da Conta
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      Tarefas Registradas
                    </span>
                    <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-2">
                      {stats.tasks}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      Metas Criadas
                    </span>
                    <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
                      {stats.goals}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      Lembretes Ativos
                    </span>
                    <p className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-2">
                      {stats.reminders}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações do Sistema / Projeto */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-purple-900/30 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  Detalhes do Sistema
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">
                      Modo de Armazenamento
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-gray-200">
                      Local Storage (Persistente)
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">
                      Status do Projeto
                    </span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">
                      Completo / Acadêmico
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      Stack Tecnológica
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-gray-200">
                      React, TypeScript & Tailwind CSS
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
