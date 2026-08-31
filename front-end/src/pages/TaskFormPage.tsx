import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type {
  Task,
  Category,
  Priority,
  Shift,
  TaskStatus,
} from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { useApiResource } from "../hooks/useApiResource";
import {
  formatDateForInput,
  formatMinutesToTime,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  SHIFT_LABELS,
} from "../lib/formatters";
import {
  Button,
  ErrorState,
  Field,
  FormPage,
  LoadingState,
  Select,
} from "../components/ui";

export type TaskFormData = Omit<Task, "id">;
const fromTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export function TaskFormPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(
    () =>
      id
        ? virtualPlannerApi.getTaskById(Number(id))
        : Promise.resolve(undefined),
    [id],
  );
  const resource = useApiResource(load);
  return (
    <FormPage
      title={id ? "Editar tarefa" : "Nova tarefa"}
      backLink={
        <Link to="/tasks" className="btn btn-ghost">
          Voltar
        </Link>
      }
    >
      {resource.isLoading ? (
        <LoadingState label="Carregando tarefa…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        <TaskForm key={id ?? "new"} id={id} initial={resource.data} />
      )}
    </FormPage>
  );
}

function TaskForm({ id, initial }: { id?: string; initial?: Task }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = formatDateForInput();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const presetDate = searchParams.get("date");
  const presetStart = Number(searchParams.get("start"));
  const start =
    searchParams.has("start") &&
    Number.isInteger(presetStart) &&
    presetStart >= 0 &&
    presetStart < 1440
      ? presetStart
      : 480;
  const [form, setForm] = useState<TaskFormData>(() => ({
    description: initial?.description ?? "",
    category: initial?.category ?? "Study",
    date:
      initial?.date ?? (presetDate && presetDate >= today ? presetDate : today),
    startMinutes: initial ? initial.startMinutes : start,
    endMinutes: initial ? initial.endMinutes : Math.min(start + 60, 1440),
    shift: initial?.shift,
    priority: initial?.priority ?? "Medium",
    status: initial?.status ?? "Pending",
  }));
  const [timeMode, setTimeMode] = useState<"exact" | "shift">(
    initial?.shift && initial.startMinutes == null ? "shift" : "exact",
  );
  const set = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.description.trim()) {
      setError("Informe a descrição da tarefa.");
      return;
    }
    if (!id && form.date < today) {
      setError("Não dá para agendar uma tarefa no passado.");
      return;
    }
    if (
      timeMode === "exact" &&
      (!Number.isInteger(form.startMinutes) ||
        !Number.isInteger(form.endMinutes) ||
        form.startMinutes == null ||
        form.endMinutes == null ||
        form.startMinutes < 0 ||
        form.endMinutes > 1440 ||
        form.endMinutes <= form.startMinutes)
    ) {
      setError(
        "Informe um intervalo válido: o fim precisa ser depois do início.",
      );
      return;
    }
    const payload =
      timeMode === "shift"
        ? {
            ...form,
            shift: form.shift ?? "Morning",
            startMinutes: undefined,
            endMinutes: undefined,
          }
        : { ...form, shift: undefined };
    submitting.current = true;
    setSaving(true);
    setError(undefined);
    try {
      if (id) await virtualPlannerApi.updateTask(Number(id), payload);
      else await virtualPlannerApi.createTask(payload);
      navigate("/tasks");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a tarefa.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={saving} className="space-y-5">
        <Field label="Descrição">
          <input
            className="input"
            required
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Ex.: revisar o capítulo 3"
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Categoria">
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data">
            <input
              type="date"
              className="input"
              required
              min={id ? undefined : today}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Agendamento">
          <Select
            value={timeMode}
            onChange={(e) => setTimeMode(e.target.value as typeof timeMode)}
          >
            <option value="exact">Horário</option>
            <option value="shift">Turno</option>
          </Select>
        </Field>
        {timeMode === "exact" ? (
          <div className="grid grid-cols-2 gap-5">
            <Field label="Início">
              <input
                type="time"
                className="input"
                required
                value={
                  form.startMinutes == null
                    ? ""
                    : formatMinutesToTime(form.startMinutes)
                }
                onChange={(e) => set("startMinutes", fromTime(e.target.value))}
              />
            </Field>
            <Field label="Fim" hint="00:00 indica o fim do dia.">
              <input
                type="time"
                className="input"
                required
                value={
                  form.endMinutes == null
                    ? ""
                    : form.endMinutes === 1440
                      ? "00:00"
                      : formatMinutesToTime(form.endMinutes)
                }
                onChange={(e) =>
                  set(
                    "endMinutes",
                    e.target.value === "00:00"
                      ? 1440
                      : fromTime(e.target.value),
                  )
                }
              />
            </Field>
          </div>
        ) : (
          <Field label="Turno do dia">
            <Select
              value={form.shift ?? "Morning"}
              onChange={(e) => set("shift", e.target.value as Shift)}
            >
              {(Object.keys(SHIFT_LABELS) as Shift[]).map((value) => (
                <option key={value} value={value}>
                  {SHIFT_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Prioridade">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as Priority)}
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          {id && (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => set("status", e.target.value as TaskStatus)}
              >
                {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {TASK_STATUS_LABELS[value]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
          )}
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/tasks" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : id ? "Salvar alterações" : "Criar tarefa"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
