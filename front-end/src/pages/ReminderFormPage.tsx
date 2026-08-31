import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type {
  Reminder,
  Category,
  ReminderRecurrence,
  ReminderType,
} from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { useApiResource } from "../hooks/useApiResource";
import {
  formatDateForInput,
  formatMinutesToTime,
  CATEGORY_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_RECURRENCE_LABELS,
} from "../lib/formatters";
import {
  Button,
  ErrorState,
  Field,
  FormPage,
  LoadingState,
  Select,
} from "../components/ui";

export type ReminderFormData = Omit<Reminder, "id">;
const fromTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export function ReminderFormPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(
    () =>
      id
        ? virtualPlannerApi.getReminderById(Number(id))
        : Promise.resolve(undefined),
    [id],
  );
  const resource = useApiResource(load);
  return (
    <FormPage
      title={id ? "Editar lembrete" : "Novo lembrete"}
      backLink={
        <Link to="/reminders" className="btn btn-ghost">
          Voltar
        </Link>
      }
    >
      {resource.isLoading ? (
        <LoadingState label="Carregando lembrete…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        <ReminderForm key={id ?? "new"} id={id} initial={resource.data} />
      )}
    </FormPage>
  );
}

function ReminderForm({ id, initial }: { id?: string; initial?: Reminder }) {
  const navigate = useNavigate();
  const today = formatDateForInput();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<ReminderFormData>(() => ({
    description: initial?.description ?? "",
    category: initial?.category ?? "Study",
    date: initial?.date ?? today,
    startMinutes: initial?.startMinutes ?? 480,
    endMinutes: initial?.endMinutes ?? 540,
    type: initial?.type ?? "Meeting",
    recurrence: initial?.recurrence ?? "Once",
  }));
  const set = <K extends keyof ReminderFormData>(
    key: K,
    value: ReminderFormData[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.description.trim()) {
      setError("Informe a descrição do lembrete.");
      return;
    }
    if (!id && form.date < today) {
      setError("Não dá para agendar um lembrete no passado.");
      return;
    }
    if (
      !Number.isInteger(form.startMinutes) ||
      !Number.isInteger(form.endMinutes) ||
      form.startMinutes < 0 ||
      form.endMinutes > 1440 ||
      form.endMinutes <= form.startMinutes
    ) {
      setError(
        "Informe um intervalo válido: o fim precisa ser depois do início.",
      );
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(undefined);
    try {
      if (id) await virtualPlannerApi.updateReminder(Number(id), form);
      else await virtualPlannerApi.createReminder(form);
      navigate("/reminders");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o lembrete.",
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
            placeholder="Ex.: reunião de alinhamento com a equipe"
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Tipo">
            <Select
              value={form.type}
              onChange={(e) => set("type", e.target.value as ReminderType)}
            >
              {(Object.keys(REMINDER_TYPE_LABELS) as ReminderType[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {REMINDER_TYPE_LABELS[value]}
                  </option>
                ),
              )}
            </Select>
          </Field>
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
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Data-base">
            <input
              type="date"
              className="input"
              required
              min={id ? undefined : today}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Início">
            <input
              type="time"
              className="input"
              required
              value={formatMinutesToTime(form.startMinutes)}
              onChange={(e) => set("startMinutes", fromTime(e.target.value))}
            />
          </Field>
          <Field label="Fim" hint="00:00 indica o fim do dia.">
            <input
              type="time"
              className="input"
              required
              value={
                form.endMinutes === 1440
                  ? "00:00"
                  : formatMinutesToTime(form.endMinutes)
              }
              onChange={(e) =>
                set(
                  "endMinutes",
                  e.target.value === "00:00" ? 1440 : fromTime(e.target.value),
                )
              }
            />
          </Field>
        </div>
        <Field label="Recorrência">
          <Select
            value={form.recurrence}
            onChange={(e) =>
              set("recurrence", e.target.value as ReminderRecurrence)
            }
          >
            {(
              Object.keys(REMINDER_RECURRENCE_LABELS) as ReminderRecurrence[]
            ).map((value) => (
              <option key={value} value={value}>
                {REMINDER_RECURRENCE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/reminders" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : id ? "Salvar alterações" : "Criar lembrete"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
