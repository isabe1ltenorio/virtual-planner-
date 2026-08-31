import { useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateForInput } from "../lib/formatters";

interface MiniCalendarProps {
  /** Dia selecionado, YYYY-MM-DD. */
  value: string;
  onChange: (date: string) => void;
  /** Dias (YYYY-MM-DD) que têm tarefa ou lembrete — ganham um ponto. */
  marked?: Set<string>;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MiniCalendar({ value, onChange, marked }: MiniCalendarProps) {
  const selected = new Date(`${value}T00:00:00`);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const lastVisible = days[41];
  const rows = endOfMonth(viewMonth) > lastVisible ? 42 : 35;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Mês anterior"
            className="icon-btn"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            className="icon-btn"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-xs font-medium text-subtle">
            {d}
          </span>
        ))}

        {days.slice(0, rows).map((day) => {
          const key = formatDateForInput(day);
          const inMonth = isSameMonth(day, viewMonth);
          const isSelected = isSameDay(day, selected);
          const hasMark = marked?.has(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={[
                "relative flex h-8 items-center justify-center rounded-md text-sm transition-colors",
                isSelected
                  ? "bg-brand-600 font-semibold text-white"
                  : inMonth
                    ? "text-ink hover:bg-surface-2"
                    : "text-subtle hover:bg-surface-2",
                !isSelected && isToday(day) ? "ring-1 ring-brand-400" : "",
              ].join(" ")}
            >
              {day.getDate()}
              {hasMark && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
