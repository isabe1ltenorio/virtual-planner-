import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { TaskStatus } from "../types/domain";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "../lib/formatters";

interface StatusMenuProps {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
}

const ORDER = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

// Botão que abre um menu curto para trocar o status de uma tarefa sem sair da
// tela. Mesmo padrão de dropdown do seletor de tema no Header.
export function StatusMenu({ value, onChange, disabled }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const color = TASK_STATUS_COLORS[value];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-c px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
        />
        {TASK_STATUS_LABELS[value]}
        <ChevronDown size={12} strokeWidth={2.5} />
      </button>

      {open && (
        <div className="card absolute right-0 z-50 mt-1 w-44 p-1 shadow-md">
          {ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                if (status !== value) onChange(status);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: TASK_STATUS_COLORS[status] }}
              />
              <span className="flex-1 text-left">
                {TASK_STATUS_LABELS[status]}
              </span>
              {status === value && (
                <Check size={14} strokeWidth={2.5} className="text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
