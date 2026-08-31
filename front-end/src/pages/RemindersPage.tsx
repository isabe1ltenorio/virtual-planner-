import { useCallback, useState } from "react";
import { Link } from "react-router";
import { Plus, Pencil, Bell } from "lucide-react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { ReminderRecurrence, ReminderType } from "../types/domain";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_RECURRENCE_LABELS,
  formatDateShort,
  formatDateForInput,
  formatMinutesToTime,
} from "../lib/formatters";
import {
  Badge,
  Card,
  DangerConfirm,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
} from "../components/ui";
import { useApiResource } from "../hooks/useApiResource";
import { addDays } from "date-fns";
import { buttonClass } from "../components/buttonStyles";

export function RemindersPage() {
  const [type, setType] = useState<"ALL" | ReminderType>("ALL");
  const [recurrence, setRecurrence] = useState<"ALL" | ReminderRecurrence>(
    "ALL",
  );
  const [startDate, setStartDate] = useState(formatDateForInput());
  const [endDate, setEndDate] = useState(() =>
    formatDateForInput(addDays(new Date(), 30)),
  );
  const [deletingId, setDeletingId] = useState<number>();
  const [mutationError, setMutationError] = useState<string>();
  const load = useCallback(
    () =>
      virtualPlannerApi.getReminderOccurrences({
        start: startDate,
        end: endDate,
      }),
    [startDate, endDate],
  );
  const resource = useApiResource(load);
  const filtered = (resource.data ?? []).filter(
    ({ reminder }) =>
      (type === "ALL" || reminder.type === type) &&
      (recurrence === "ALL" || reminder.recurrence === recurrence),
  );
  async function handleDelete(id: number) {
    if (deletingId !== undefined) return;
    setDeletingId(id);
    setMutationError(undefined);
    try {
      await virtualPlannerApi.deleteReminder(id);
      resource.retry();
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o lembrete.",
      );
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <>
      <PageHeader
        title="Lembretes"
        subtitle="Avisos pontuais — reunião, ligação, entrega… Únicos ou recorrentes, não entram no relatório de produtividade."
        actions={
          <Link to="/reminders/new" className={buttonClass("primary")}>
            <Plus size={16} strokeWidth={2.5} />
            Novo lembrete
          </Link>
        }
      />

      <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <Field label="Recorrência">
          <select
            className="select"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
          >
            <option value="ALL">Todas</option>
            {(
              Object.keys(REMINDER_RECURRENCE_LABELS) as ReminderRecurrence[]
            ).map((value) => (
              <option key={value} value={value}>
                {REMINDER_RECURRENCE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data inicial">
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Data final">
          <input
            type="date"
            className="input"
            min={startDate}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </Field>
      </Card>

      {mutationError && <ErrorState message={mutationError} />}
      {resource.isLoading ? (
        <LoadingState label="Carregando lembretes…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
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
          {filtered.map(({ reminder, date }) => (
            <div
              key={`${reminder.id}-${date}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">
                  {reminder.description}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateShort(date)} ·{" "}
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
                <DangerConfirm
                  disabled={deletingId !== undefined}
                  description="Isso exclui o lembrete e todas as suas ocorrências."
                  onConfirm={() => handleDelete(reminder.id)}
                />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
