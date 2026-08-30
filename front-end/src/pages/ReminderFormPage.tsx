import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router";
import type {
  Reminder,
  Category,
  ReminderRecurrence,
  ReminderType,
} from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import {
  formatDateForInput,
  formatMinutesToTime,
  CATEGORY_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_RECURRENCE_LABELS,
} from "../lib/formatters";
import { Button, Field, FormPage } from "../components/ui";

export type ReminderFormData = Omit<Reminder, "id">;

function toFormData(reminder: Reminder): ReminderFormData {
  return {
    description: reminder.description,
    category: reminder.category,
    date: reminder.date,
    startMinutes: reminder.startMinutes,
    endMinutes: reminder.endMinutes,
    type: reminder.type,
    recurrence: reminder.recurrence,
  };
}

const toTime = (m: number) => formatMinutesToTime(m);
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function ReminderFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const today = formatDateForInput();

  const [form, setForm] = useState<ReminderFormData>({
    description: "",
    category: "Study",
    date: today,
    startMinutes: 480,
    endMinutes: 540,
    type: "Meeting",
    recurrence: "Once",
  });

  useEffect(() => {
    if (!isEditing || !id) return;
    virtualPlannerApi
      .getReminders()
      .then((reminders) => {
        const found = reminders.find((r) => r.id === Number(id));
        if (found) setForm(toFormData(found));
      })
      .catch((err) => console.error("Erro ao carregar lembrete:", err))
      .finally(() => setIsLoading(false));
  }, [id, isEditing]);

  const set = <K extends keyof ReminderFormData>(
    key: K,
    value: ReminderFormData[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (form.date < today) {
      setError("Não dá para agendar um lembrete no passado.");
      return;
    }
    if (form.endMinutes <= form.startMinutes) {
      setError("O fim precisa ser depois do início.");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing && id) {
        await virtualPlannerApi.updateReminder(Number(id), form);
      } else {
        await virtualPlannerApi.createReminder(form);
      }
      navigate("/reminders");
    } catch (err) {
      console.error("Erro ao salvar o lembrete:", err);
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormPage
      title={isEditing ? "Editar lembrete" : "Novo lembrete"}
      backLink={
        <Link
          to="/reminders"
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
            disabled={isLoading}
            className="input"
            placeholder="Ex.: reunião de alinhamento com a equipe"
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as ReminderType)}
              disabled={isLoading}
              className="select"
            >
              {(Object.keys(REMINDER_TYPE_LABELS) as ReminderType[]).map((t) => (
                <option key={t} value={t}>
                  {REMINDER_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Categoria">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
              disabled={isLoading}
              className="select"
            >
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Data">
            <input
              type="date"
              min={today}
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
              disabled={isLoading}
              className="input"
            />
          </Field>
          <Field label="Início">
            <input
              type="time"
              value={toTime(form.startMinutes)}
              onChange={(e) => set("startMinutes", fromTime(e.target.value))}
              disabled={isLoading}
              className="input"
            />
          </Field>
          <Field label="Fim">
            <input
              type="time"
              value={toTime(form.endMinutes)}
              onChange={(e) => set("endMinutes", fromTime(e.target.value))}
              disabled={isLoading}
              className="input"
            />
          </Field>
        </div>

        <Field label="Recorrência">
          <select
            value={form.recurrence}
            onChange={(e) =>
              set("recurrence", e.target.value as ReminderRecurrence)
            }
            disabled={isLoading}
            className="select"
          >
            {(
              Object.keys(REMINDER_RECURRENCE_LABELS) as ReminderRecurrence[]
            ).map((r) => (
              <option key={r} value={r}>
                {REMINDER_RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/reminders" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Salvando…"
              : isEditing
                ? "Salvar alterações"
                : "Criar lembrete"}
          </Button>
        </div>
      </form>
    </FormPage>
  );
}
