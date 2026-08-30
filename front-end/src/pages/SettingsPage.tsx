export function SettingsPage() {
  return (
    <div className="p-6 space-y-6 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-full transition-colors">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Configurações & Status
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Informações da Aplicação
          </h3>
          <ul className="space-y-3">
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Nome</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                Virtual Planner
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Versão</span>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                1.0.0
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                Armazenamento
              </span>
              <span className="font-medium text-purple-600 dark:text-purple-400">
                LocalStorage (Persistente)
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
