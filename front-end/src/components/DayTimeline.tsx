import { useMemo } from "react";
import { Link } from "react-router";
import type { Task } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  SHIFT_LABELS,
  formatMinutesToTime,
} from "../lib/formatters";
import { StatusMenu } from "./StatusMenu";

interface DayTimelineProps {
  tasks: Task[]; // já filtradas para o dia
  onStatusChange: (id: number, status: Task["status"]) => void;
  /** Clique numa faixa vazia da timeline → minuto arredondado a 15. */
  onEmptyClick?: (minutes: number) => void;
}

const PX_PER_MIN = 0.55; // 1h ≈ 33px — compacto; o container rola se passar
const MAX_TRACK_H = 460;
const HOUR = 60;

// Empacota tarefas que se sobrepõem em colunas lado a lado.
function assignLanes(tasks: Task[]) {
  const sorted = [...tasks].sort(
    (a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0),
  );
  const laneEnds: number[] = [];
  const placed = sorted.map((task) => {
    const start = task.startMinutes ?? 0;
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = task.endMinutes ?? start + 30;
    return { task, lane };
  });
  return { placed, lanes: Math.max(laneEnds.length, 1) };
}

export function DayTimeline({
  tasks,
  onStatusChange,
  onEmptyClick,
}: DayTimelineProps) {
  const timed = useMemo(
    () => tasks.filter((t) => t.startMinutes != null),
    [tasks],
  );
  const untimed = useMemo(
    () => tasks.filter((t) => t.startMinutes == null),
    [tasks],
  );

  const { start, end } = useMemo(() => {
    if (timed.length === 0) return { start: 8 * HOUR, end: 18 * HOUR };
    const min = Math.min(...timed.map((t) => t.startMinutes ?? 0));
    const max = Math.max(...timed.map((t) => t.endMinutes ?? 0));
    return {
      start: Math.max(0, Math.floor(min / HOUR) * HOUR - HOUR),
      end: Math.min(24 * HOUR, Math.ceil(max / HOUR) * HOUR + HOUR),
    };
  }, [timed]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = start; m <= end; m += HOUR) list.push(m);
    return list;
  }, [start, end]);

  const { placed, lanes } = useMemo(() => assignLanes(timed), [timed]);
  const height = (end - start) * PX_PER_MIN;

  return (
    <div>
      {timed.length === 0 && untimed.length === 0 ? (
        <p className="py-8 text-center text-sm text-subtle">Nada agendado.</p>
      ) : (
        <div
          className="flex gap-3 overflow-y-auto pr-1"
          style={{ maxHeight: MAX_TRACK_H }}
        >
          {/* Régua de horas */}
          <div className="relative w-12 shrink-0" style={{ height }}>
            {hours.map((m) => (
              <div
                key={m}
                className="absolute right-0 -translate-y-1/2 text-xs tabular-nums text-subtle"
                style={{ top: (m - start) * PX_PER_MIN }}
              >
                {formatMinutesToTime(m)}
              </div>
            ))}
          </div>

          {/* Faixa de blocos */}
          <div
            className={`relative flex-1 border-l border-border-c ${
              onEmptyClick ? "cursor-copy" : ""
            }`}
            style={{ height }}
            onClick={(e) => {
              if (!onEmptyClick || e.target !== e.currentTarget) return;
              const y = e.nativeEvent.offsetY;
              const raw = start + y / PX_PER_MIN;
              onEmptyClick(Math.round(raw / 15) * 15);
            }}
          >
            {hours.map((m) => (
              <div
                key={m}
                className="absolute inset-x-0 border-t border-dashed border-border-c/70"
                style={{ top: (m - start) * PX_PER_MIN }}
              />
            ))}

            {placed.map(({ task, lane }) => {
              const s = task.startMinutes ?? start;
              const e = task.endMinutes ?? s + 30;
              const color = CATEGORY_COLORS[task.category];
              const top = (s - start) * PX_PER_MIN;
              const blockH = Math.max(24, (e - s) * PX_PER_MIN - 3);
              return (
                <div
                  key={task.id}
                  className="absolute overflow-hidden rounded-md border-l-2 pl-2 pr-1.5 py-1 text-xs"
                  style={{
                    top,
                    height: blockH,
                    left: `calc(${(lane / lanes) * 100}% + 4px)`,
                    width: `calc(${100 / lanes}% - 8px)`,
                    borderColor: color,
                    background: `color-mix(in srgb, ${color} 12%, var(--surface))`,
                  }}
                >
                  <Link
                    to={`/tasks/${task.id}/edit`}
                    className="block truncate font-medium text-ink hover:underline"
                  >
                    {task.description}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="tabular-nums">
                      {formatMinutesToTime(s)}–{formatMinutesToTime(e)}
                    </span>
                    <span className="truncate">
                      · {CATEGORY_LABELS[task.category]}
                    </span>
                  </div>
                  {blockH > 52 && (
                    <div className="mt-1">
                      <StatusMenu
                        value={task.status}
                        onChange={(next) => onStatusChange(task.id, next)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sem horário: turno ou lembretes */}
      {untimed.length > 0 && (
        <div className="mt-4 border-t border-border-c pt-3">
          <p className="mb-2 text-xs font-medium text-subtle">Sem horário fixo</p>
          <ul className="space-y-2">
            {untimed.map((task) => (
              <li key={task.id} className="flex items-center gap-3 text-sm">
                <span
                  className="h-6 w-1 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLORS[task.category] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {task.description}
                  </p>
                  <p className="text-xs text-muted">
                    {CATEGORY_LABELS[task.category]}
                    {task.shift && ` · ${SHIFT_LABELS[task.shift]}`}
                  </p>
                </div>
                <StatusMenu
                  value={task.status}
                  onChange={(next) => onStatusChange(task.id, next)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
