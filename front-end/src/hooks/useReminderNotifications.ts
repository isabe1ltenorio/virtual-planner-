import { useEffect, useRef } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { occursOn } from "../lib/reminderSchedule";
import { REMINDER_TYPE_LABELS } from "../lib/formatters";
import type { Reminder } from "../types/domain";

const POLL_MS = 5 * 60 * 1000;

/**
 * Dispara uma notificação do navegador no horário de cada lembrete de hoje —
 * enquanto a aba estiver aberta.
 *
 * Limitações assumidas (versão leve, sem service worker / push):
 *  - só funciona com a aba aberta; abas em segundo plano podem atrasar o
 *    timer em até ~1 min;
 *  - se a permissão não estiver concedida, o hook simplesmente não faz nada.
 */
export function useReminderNotifications(): void {
  const fired = useRef<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    let cancelled = false;
    const clearTimers = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    async function schedule() {
      clearTimers();
      if (Notification.permission !== "granted") return;

      let reminders: Reminder[];
      try {
        reminders = await virtualPlannerApi.getReminders();
      } catch {
        return;
      }
      if (cancelled) return;

      const now = new Date();
      const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const dayKey = today.toISOString().slice(0, 10);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (const reminder of reminders) {
        if (reminder.startMinutes == null) continue;
        if (!occursOn(reminder, today)) continue;

        const key = `${reminder.id}:${dayKey}:${reminder.startMinutes}`;
        if (fired.current.has(key)) continue;

        const deltaMinutes = reminder.startMinutes - nowMinutes;
        if (deltaMinutes < 0) continue; // já passou hoje

        // Alinha o disparo ao início do minuto do lembrete.
        const delayMs = deltaMinutes * 60_000 - now.getSeconds() * 1000;

        const timer = window.setTimeout(
          () => {
            fired.current.add(key);
            try {
              new Notification(
                `Lembrete · ${REMINDER_TYPE_LABELS[reminder.type]}`,
                { body: reminder.description, tag: key },
              );
            } catch {
              /* alguns navegadores bloqueiam Notification fora de um SW */
            }
          },
          Math.max(0, delayMs),
        );

        timers.current.push(timer);
      }
    }

    void schedule();
    const poll = window.setInterval(schedule, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void schedule();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimers();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
