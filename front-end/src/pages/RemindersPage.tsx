import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, Bell } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { Reminder, ReminderType } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_RECURRENCE_LABELS,
  formatDateShort,
  formatMinutesToTime,
} from "../lib/formatters";
import {
  Badge,
  Card,
  DangerConfirm,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { buttonClass } from "../components/buttonStyles";

export function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [type, setType] = useState<"ALL" | ReminderType>("ALL");

  useEffect(() => {
    virtualPlannerApi
      .getReminders()
      .then(setReminders)
      .catch((e) => console.error("Erro ao buscar lembretes:", e))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleDelete(id: number) {
    try {
      await virtualPlannerApi.deleteReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Erro ao excluir lembrete:", error);
    }
  }

  const filtered = reminders.filter(
    (r) => type === "ALL" || r.type === type,
  );

  return (
    <>
      <PageHeader
        title="Lembretes"
        subtitle="Avisos semanais, únicos ou recorrentes."
        actions={
          <Link to="/reminders/new" className={buttonClass("primary")}>
            <Plus size={16} strokeWidth={2.5} />
            Novo lembrete
          </Link>
        }
      />

      <Card className="p-4 sm:max-w-xs">
        <Field label="Tipo">
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="ALL">Todos os tipos</option>
            {(Object.keys(REMINDER_TYPE_LABELS) as ReminderType[]).map((t) => (
              <option key={t} value={t}>
                {REMINDER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {isLoading ? (
        <LoadingState label="Carregando lembretes…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} strokeWidth={1.5} />}
          title="Sem lembretes"
          description="Crie um lembrete para reuniões, entregas, exercícios e afins."
          action={
            <Link to="/reminders/new" className={buttonClass("primary")}>
              <Plus size={16} strokeWidth={2.5} />
              Novo lembrete
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-border-c overflow-hidden">
          {filtered.map((reminder) => (
            <div
              key={reminder.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {reminder.description}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateShort(reminder.date)} ·{" "}
                  {formatMinutesToTime(reminder.startMinutes)} ·{" "}
                  {REMINDER_RECURRENCE_LABELS[reminder.recurrence]}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={CATEGORY_COLORS[reminder.category]}>
                  {CATEGORY_LABELS[reminder.category]}
                </Badge>
                <Badge>{REMINDER_TYPE_LABELS[reminder.type]}</Badge>
                <Link
                  to={`/reminders/${reminder.id}/edit`}
                  className={`${buttonClass("ghost")} text-muted`}
                >
                  <Pencil size={14} />
                  Editar
                </Link>
                <DangerConfirm onConfirm={() => handleDelete(reminder.id)} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
