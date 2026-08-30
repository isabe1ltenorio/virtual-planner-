export const getThemeColors = (value: string) => {
  const val = value?.toLowerCase().trim() || "";

  // --- STATUS ---
  if (val === "executed" || val === "completed")
    return {
      badge:
        "text-emerald-700 bg-emerald-100/80 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800",
      cardBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
      border: "border-emerald-300 dark:border-emerald-800/60",
      text: "text-emerald-700 dark:text-emerald-400",
    };
  if (val === "cancelled" || val === "failed")
    return {
      badge:
        "text-red-700 bg-red-100/80 border border-red-300 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800",
      cardBg: "bg-red-50/60 dark:bg-red-950/20",
      border: "border-red-300 dark:border-red-800/60",
      text: "text-red-700 dark:text-red-400",
    };
  if (val === "partiallyexecuted" || val === "partially completed")
    return {
      badge:
        "text-amber-700 bg-amber-100/80 border border-amber-300 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800",
      cardBg: "bg-amber-50/60 dark:bg-amber-950/20",
      border: "border-amber-300 dark:border-amber-800/60",
      text: "text-amber-700 dark:text-amber-400",
    };
  if (val === "pending" || val === "in progress")
    return {
      badge:
        "text-blue-700 bg-blue-100/80 border border-blue-300 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800",
      cardBg: "bg-blue-50/60 dark:bg-blue-950/20",
      border: "border-blue-300 dark:border-blue-800/60",
      text: "text-blue-700 dark:text-blue-400",
    };
  if (val === "postponed")
    return {
      badge:
        "text-orange-700 bg-orange-100/80 border border-orange-300 dark:text-orange-400 dark:bg-orange-950/50 dark:border-orange-800",
      cardBg: "bg-orange-50/60 dark:bg-orange-950/20",
      border: "border-orange-300 dark:border-orange-800/60",
      text: "text-orange-700 dark:text-orange-400",
    };

  // --- CATEGORIAS ---
  if (val === "college")
    return {
      badge:
        "text-blue-700 bg-blue-100/80 border border-blue-300 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800",
      cardBg: "bg-blue-50/60 dark:bg-blue-950/20",
      border: "border-blue-300 dark:border-blue-800/60",
      text: "text-blue-700 dark:text-blue-400",
    };
  if (val === "work")
    return {
      badge:
        "text-amber-700 bg-amber-100/80 border border-amber-300 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800",
      cardBg: "bg-amber-50/60 dark:bg-amber-950/20",
      border: "border-amber-300 dark:border-amber-800/60",
      text: "text-amber-700 dark:text-amber-400",
    };
  if (val === "health")
    return {
      badge:
        "text-emerald-700 bg-emerald-100/80 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800",
      cardBg: "bg-emerald-50/60 dark:bg-emerald-950/20",
      border: "border-emerald-300 dark:border-emerald-800/60",
      text: "text-emerald-700 dark:text-emerald-400",
    };
  if (val === "leisure")
    return {
      badge:
        "text-pink-700 bg-pink-100/80 border border-pink-300 dark:text-pink-400 dark:bg-pink-950/50 dark:border-pink-800",
      cardBg: "bg-pink-50/60 dark:bg-pink-950/20",
      border: "border-pink-300 dark:border-pink-800/60",
      text: "text-pink-700 dark:text-pink-400",
    };
  if (val === "study")
    return {
      badge:
        "text-indigo-700 bg-indigo-100/80 border border-indigo-300 dark:text-indigo-400 dark:bg-indigo-950/50 dark:border-indigo-800",
      cardBg: "bg-indigo-50/60 dark:bg-indigo-950/20",
      border: "border-indigo-300 dark:border-indigo-800/60",
      text: "text-indigo-700 dark:text-indigo-400",
    };

  // Padrão Roxo (PersonalProjects e outros)
  return {
    badge:
      "text-purple-700 bg-purple-100/80 border border-purple-300 dark:text-purple-300 dark:bg-purple-950/50 dark:border-purple-800",
    cardBg: "bg-purple-50/60 dark:bg-purple-950/20",
    border: "border-purple-300 dark:border-purple-800/60",
    text: "text-purple-700 dark:text-purple-400",
  };
};

export const getPriorityColors = (priority: string) => {
  const p = priority?.toLowerCase() || "";
  if (p === "high")
    return "text-red-700 bg-red-100/80 border border-red-300 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800";
  if (p === "medium")
    return "text-amber-700 bg-amber-100/80 border border-amber-300 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800";
  if (p === "low")
    return "text-emerald-700 bg-emerald-100/80 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800";
  return "text-gray-700 bg-gray-200 dark:text-gray-400 dark:bg-gray-800 border border-gray-300 dark:border-gray-700";
};
