import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router";
import type {
  Task,
  Category,
  Priority,
  Shift,
  TaskStatus,
} from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import {
  formatDateForInput,
  formatMinutesToTime,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  SHIFT_LABELS,
} from "../lib/formatters";
import { Button, Field, FormPage } from "../components/ui";

export type TaskFormData = Omit<Task, "id">;

function toFormData(task: Task): TaskFormData {
  return {
    description: task.description,
    category: task.category,
    date: task.date,
    startMinutes: task.startMinutes,
    endMinutes: task.endMinutes,
    shift: task.shift,
    priority: task.priority,
    status: task.status,
    color: task.color,
  };
}

// "09:00" <-> minutos, para inputs type="time"
const toTime = (m?: number) => (m == null ? "" : formatMinutesToTime(m));
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function TaskFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(isEditing);
  const today = formatDateForInput();

  const [form, setForm] = useState<TaskFormData>({
    description: "",
    category: "Study",
    date: today,
    startMinutes: 480,
    endMinutes: 540,
    priority: "Medium",
    status: "Pending",
  });
  const [timeMode, setTimeMode] = useState<"exact" | "shift">("exact");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || !id) return;
    virtualPlannerApi
      .getTasks()
      .then((tasks) => {
        const found = tasks.find((t) => t.id === Number(id));
        if (found) {
          setForm(toFormData(found));
          setTimeMode(found.shift && found.startMinutes == null ? "shift" : "exact");
        }
      })
      .catch((err) => console.error("Erro ao carregar tarefa:", err))
      .finally(() => setIsLoading(false));
  }, [id, isEditing]);

  const set = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (form.date < today) {
      setError("Não dá para agendar uma tarefa no passado.");
      return;
    }

    const payload: TaskFormData =
      timeMode === "shift"
        ? {
            ...form,
            startMinutes: undefined,
            endMinutes: undefined,
          }
        : { ...form, shift: undefined };

    if (
      timeMode === "exact" &&
      payload.startMinutes != null &&
      payload.endMinutes != null &&
      payload.endMinutes <= payload.startMinutes
    ) {
      setError("O fim precisa ser depois do início.");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing && id) {
        await virtualPlannerApi.updateTask(Number(id), payload);
      } else {
        await virtualPlannerApi.createTask(payload);
      }
      navigate("/tasks");
    } catch (err) {
      console.error("Erro ao salvar a tarefa:", err);
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormPage
      title={isEditing ? "Editar tarefa" : "Nova tarefa"}
      backLink={
        <Link
          to="/tasks"
          className="text-sm font-medium text-muted hover:text-ink"
        >
          Voltar
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Descrição">
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            required
            className="input"
            placeholder="Ex.: revisar o capítulo 3"
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
              className="select"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Data">
            <input
              type="date"
              min={today}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
              className="input"
            />
          </Field>
        </div>

        <div>
          <span className="field-label">Quando</span>
          <div className="mb-3 inline-flex rounded-lg border border-border-c bg-surface p-0.5">
            {(["exact", "shift"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTimeMode(mode)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  timeMode === mode
                    ? "bg-brand-600 text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                {mode === "exact" ? "Horário" : "Turno"}
              </button>
            ))}
          </div>

          {timeMode === "exact" ? (
            <div className="grid grid-cols-2 gap-5">
              <Field label="Início">
                <input
                  type="time"
                  value={toTime(form.startMinutes)}
                  onChange={(e) =>
                    set("startMinutes", fromTime(e.target.value))
                  }
                  className="input"
                />
              </Field>
              <Field label="Fim">
                <input
                  type="time"
                  value={toTime(form.endMinutes)}
                  onChange={(e) => set("endMinutes", fromTime(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
          ) : (
            <Field
              label="Turno do dia"
              hint="A tarefa fica no turno, sem horário específico."
            >
              <select
                value={form.shift ?? "Morning"}
                onChange={(e) => set("shift", e.target.value as Shift)}
                className="select"
              >
                {(Object.keys(SHIFT_LABELS) as Shift[]).map((s) => (
                  <option key={s} value={s}>
                    {SHIFT_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Prioridade">
            <select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
              className="select"
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as TaskStatus)}
              className="select"
            >
              {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/tasks" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Salvando…"
              : isEditing
                ? "Salvar alterações"
                : "Criar tarefa"}
          </Button>
        </div>
      </form>
    </FormPage>
  );
}
