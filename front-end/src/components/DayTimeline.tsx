import { useMemo } from "react";
import { Link } from "react-router";
import type { ReminderOccurrence } from "../lib/api/remindersApi";
import type { Reminder, Task } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  SHIFT_LABELS,
  formatMinutesToTime,
} from "../lib/formatters";
import type { Shift } from "../types/domain";
import { StatusMenu } from "./StatusMenu";

// Espelha domain::shift_window do backend.
const SHIFT_WINDOW: Record<Shift, { start: number; end: number }> = {
  Morning: { start: 6 * 60, end: 12 * 60 },
  Afternoon: { start: 12 * 60, end: 18 * 60 },
  Evening: { start: 18 * 60, end: 24 * 60 },
};

interface DayTimelineProps {
  tasks: Task[]; // já filtradas para o dia
  onStatusChange: (id: number, status: Task["status"]) => void;
  updatingTaskIds?: ReadonlySet<number>;
  occurrences?: ReminderOccurrence[];
  conflictTaskIds?: ReadonlySet<number>;
  /** Clique numa faixa vazia da timeline → minuto arredondado a 15. */
  onEmptyClick?: (minutes: number) => void;
}

const PX_PER_MIN = 1.2; // 1h = 72px; agendas longas rolam dentro do card.
const MIN_BLOCK_H = 24;
const MAX_TRACK_H = 460;
const HOUR = 60;

type TimelineItem = { key: string; start: number; end: number } & (
  { kind: "task"; entity: Task } | { kind: "reminder"; entity: Reminder }
);

// Colunas são apenas apresentação; a indicação de conflito vem da API.
function assignLanes(items: TimelineItem[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  const placed = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = Math.max(
      item.end,
      item.start + (MIN_BLOCK_H + 3) / PX_PER_MIN,
    );
    return { item, lane };
  });
  return { placed, lanes: Math.max(laneEnds.length, 1) };
}

export function DayTimeline({
  tasks,
  onStatusChange,
  updatingTaskIds,
  occurrences,
  conflictTaskIds,
  onEmptyClick,
}: DayTimelineProps) {
  const timed = useMemo<TimelineItem[]>(
    () => [
      ...tasks.flatMap((task): TimelineItem[] =>
        task.startMinutes == null
          ? []
          : [
              {
                key: `task-${task.id}`,
                kind: "task",
                entity: task,
                start: task.startMinutes,
                end: task.endMinutes ?? task.startMinutes + 30,
              },
            ],
      ),
      ...(occurrences ?? []).map(({ reminder, date }): TimelineItem => ({
        key: `reminder-${reminder.id}-${date}`,
        kind: "reminder",
        entity: reminder,
        start: reminder.startMinutes,
        end: reminder.endMinutes,
      })),
    ],
    [tasks, occurrences],
  );
  // Tarefas por turno: viram uma faixa larga na janela do turno.
  const shiftTasks = useMemo(
    () => tasks.filter((t) => t.startMinutes == null && t.shift),
    [tasks],
  );
  // Sem horário nem turno (não deveria acontecer, mas é defensivo).
  const looseTasks = useMemo(
    () => tasks.filter((t) => t.startMinutes == null && !t.shift),
    [tasks],
  );

  const { start, end } = useMemo(() => {
    const starts: number[] = [];
    const ends: number[] = [];
    timed.forEach((t) => {
      starts.push(t.start);
      ends.push(t.end);
    });
    shiftTasks.forEach((t) => {
      const w = SHIFT_WINDOW[t.shift as Shift];
      starts.push(w.start);
      ends.push(w.end);
    });
    if (starts.length === 0) return { start: 8 * HOUR, end: 18 * HOUR };
    return {
      start: Math.max(0, Math.floor(Math.min(...starts) / HOUR) * HOUR - HOUR),
      end: Math.min(
        24 * HOUR,
        Math.ceil(Math.max(...ends) / HOUR) * HOUR + HOUR,
      ),
    };
  }, [timed, shiftTasks]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = start; m <= end; m += HOUR) list.push(m);
    return list;
  }, [start, end]);

  const { placed, lanes } = useMemo(() => assignLanes(timed), [timed]);
  const height = Math.max(
    (end - start) * PX_PER_MIN,
    ...timed.map((item) => (item.start - start) * PX_PER_MIN + MIN_BLOCK_H),
  );

  return (
    <div>
      {timed.length === 0 &&
      shiftTasks.length === 0 &&
      looseTasks.length === 0 ? (
        onEmptyClick ? (
          <button
            type="button"
            onClick={() => onEmptyClick(9 * 60)}
            className="w-full rounded-lg border border-dashed border-border-c py-8 text-center text-sm text-subtle transition-colors hover:border-brand-400 hover:text-muted"
          >
            Nada agendado — clique para criar uma tarefa
          </button>
        ) : (
          <p className="py-8 text-center text-sm text-subtle">Nada agendado.</p>
        )
      ) : (
        <div
          className="flex gap-3 overflow-y-auto py-2 pr-1"
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
            style={{ height, minWidth: lanes * 160 }}
            onClick={(e) => {
              if (!onEmptyClick || e.target !== e.currentTarget) return;
              const y = e.nativeEvent.offsetY;
              const raw = start + y / PX_PER_MIN;
              if (raw >= 24 * HOUR) return;
              onEmptyClick(Math.min(24 * HOUR - 15, Math.round(raw / 15) * 15));
            }}
          >
            {hours.map((m) => (
              <div
                key={m}
                className="absolute inset-x-0 border-t border-dashed border-border-c/70"
                style={{ top: (m - start) * PX_PER_MIN }}
              />
            ))}

            {placed.map(({ item, lane }) => {
              const s = item.start;
              const e = item.end;
              const color = CATEGORY_COLORS[item.entity.category];
              const hasConflict =
                item.kind === "task" && conflictTaskIds?.has(item.entity.id);
              const top = (s - start) * PX_PER_MIN;
              const blockH = Math.max(MIN_BLOCK_H, (e - s) * PX_PER_MIN - 3);
              const compact = blockH < 44;
              return (
                <div
                  key={item.key}
                  className={`absolute overflow-hidden rounded-md border-l-2 pl-2 pr-1.5 py-1 text-xs ${hasConflict ? "ring-2 ring-red-600 dark:ring-red-400" : ""}`}
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
                    to={`/${item.kind === "task" ? "tasks" : "reminders"}/${item.entity.id}/edit`}
                    className="flex min-w-0 items-center gap-1 font-medium text-ink hover:underline"
                    title={`${item.entity.description} · ${formatMinutesToTime(s)}–${formatMinutesToTime(e)} · ${CATEGORY_LABELS[item.entity.category]}`}
                  >
                    {hasConflict && (
                      <span
                        className="shrink-0"
                        aria-label="Conflito de horário"
                      >
                        ⚠
                      </span>
                    )}
                    {compact && (
                      <span className="shrink-0 whitespace-nowrap text-[11px] leading-4 tabular-nums">
                        {formatMinutesToTime(s)}–{formatMinutesToTime(e)}
                      </span>
                    )}{" "}
                    <span className="truncate">
                      {item.kind === "reminder" ? "Lembrete: " : ""}
                      {item.entity.description}
                    </span>
                  </Link>
                  {!compact && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        {formatMinutesToTime(s)}–{formatMinutesToTime(e)}
                      </span>
                      <span className="truncate">
                        · {CATEGORY_LABELS[item.entity.category]}
                      </span>
                    </div>
                  )}
                  {item.kind === "task" &&
                    blockH >= 60 &&
                    conflictTaskIds?.has(item.entity.id) && (
                      <span className="block font-semibold text-red-700 dark:text-red-300">
                        Conflito de horário
                      </span>
                    )}
                  {item.kind === "task" &&
                    blockH >= (hasConflict ? 92 : 76) && (
                      <div className="mt-1">
                        <StatusMenu
                          value={item.entity.status}
                          disabled={updatingTaskIds?.has(item.entity.id)}
                          onChange={(next) =>
                            onStatusChange(item.entity.id, next)
                          }
                        />
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {/* Coluna de turnos: cada tarefa por turno ocupa a janela do turno,
              numa faixa própria à direita — nunca colide com os blocos. */}
          {shiftTasks.length > 0 && (
            <div className="relative w-44 shrink-0" style={{ height }}>
              {(Object.keys(SHIFT_WINDOW) as Shift[]).map((shift) => {
                const group = shiftTasks.filter((task) => task.shift === shift);
                if (group.length === 0) return null;
                const w = SHIFT_WINDOW[shift];
                return (
                  <div
                    key={shift}
                    className="absolute overflow-y-auto rounded-md border border-dashed border-border-c bg-surface px-1.5 py-1 text-[11px]"
                    style={{
                      top: (w.start - start) * PX_PER_MIN,
                      height: (w.end - w.start) * PX_PER_MIN - 3,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <span className="mb-0.5 block font-medium text-subtle">
                      {SHIFT_LABELS[shift]}
                    </span>
                    {group.map((task) => (
                      <div
                        key={task.id}
                        className="border-l-2 pl-1 py-2"
                        style={{ borderColor: CATEGORY_COLORS[task.category] }}
                      >
                        <Link
                          to={`/tasks/${task.id}/edit`}
                          className="block truncate font-medium text-ink hover:underline"
                        >
                          {task.description}
                        </Link>
                        {conflictTaskIds?.has(task.id) && (
                          <span className="block font-semibold text-red-700 dark:text-red-300">
                            Conflito de horário
                          </span>
                        )}
                        <div className="mt-1">
                          <StatusMenu
                            value={task.status}
                            disabled={updatingTaskIds?.has(task.id)}
                            onChange={(next) => onStatusChange(task.id, next)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sem horário nem turno */}
      {looseTasks.length > 0 && (
        <div className="mt-4 border-t border-border-c pt-3">
          <p className="mb-2 text-xs font-medium text-subtle">Sem horário</p>
          <ul className="space-y-2">
            {looseTasks.map((task) => (
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
                  </p>
                </div>
                <StatusMenu
                  value={task.status}
                  disabled={updatingTaskIds?.has(task.id)}
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
