import { useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type State = NotificationPermission | "unsupported";

function initialState(): State {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

/**
 * Botão de permissão para as notificações de lembrete (aba aberta).
 * O agendamento em si fica no hook useReminderNotifications.
 */
export function NotificationToggle() {
  const [state, setState] = useState<State>(initialState);

  if (state === "unsupported") return null;

  if (state === "granted") {
    return (
      <span className="icon-btn" title="Avisos de lembrete ativos">
        <BellRing size={16} className="text-brand-600" />
      </span>
    );
  }

  if (state === "denied") {
    return (
      <span
        className="icon-btn"
        title="Avisos bloqueados — libere as notificações deste site no navegador"
      >
        <BellOff size={16} />
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-outline"
      onClick={async () => {
        try {
          setState(await Notification.requestPermission());
        } catch {
          setState("denied");
        }
      }}
      title="Receber um aviso no horário de cada lembrete (só com a aba aberta)"
    >
      <Bell size={16} />
      <span className="hidden sm:inline">Ativar avisos</span>
    </button>
  );
}
