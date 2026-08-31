import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import type { TaskStatus } from "../types/domain";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "../lib/formatters";

interface StatusMenuProps {
  value: TaskStatus;
  onChange: (next: TaskStatus) => void;
  disabled?: boolean;
}

const ORDER = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const MENU_W = 176;

// Botão que abre um menu curto para trocar o status de uma tarefa sem sair da
// tela. O menu é renderizado em portal com posição fixa porque os pais na
// timeline têm overflow-hidden e cortariam o dropdown.
export function StatusMenu({ value, onChange, disabled }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: Math.max(
        8,
        Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8),
      ),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Menu com posição fixa descola ao rolar — fecha em vez de flutuar torto.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const color = TASK_STATUS_COLORS[value];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
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

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="card fixed z-[100] p-1 shadow-lg"
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
          >
            {ORDER.map((status) => (
              <button
                key={status}
                type="button"
                role="option"
                aria-selected={status === value}
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
                  <Check
                    size={14}
                    strokeWidth={2.5}
                    className="text-brand-600"
                  />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
