import { useCallback, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { Goal, Category, GoalPeriod, GoalStatus } from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { useApiResource } from "../hooks/useApiResource";
import {
  formatDateForInput,
  CATEGORY_LABELS,
  GOAL_PERIOD_LABELS,
  GOAL_STATUS_LABELS,
} from "../lib/formatters";
import {
  Button,
  ErrorState,
  Field,
  FormPage,
  LoadingState,
  Select,
} from "../components/ui";

export type GoalFormData = Omit<Goal, "id">;

export function GoalFormPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(
    () =>
      id
        ? virtualPlannerApi.getGoalById(Number(id))
        : Promise.resolve(undefined),
    [id],
  );
  const resource = useApiResource(load);
  return (
    <FormPage
      title={id ? "Editar meta" : "Nova meta"}
      backLink={
        <Link to="/goals" className="btn btn-ghost">
          Voltar
        </Link>
      }
    >
      {resource.isLoading ? (
        <LoadingState label="Carregando meta…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        <GoalForm key={id ?? "new"} id={id} initial={resource.data} />
      )}
    </FormPage>
  );
}

function GoalForm({ id, initial }: { id?: string; initial?: Goal }) {
  const navigate = useNavigate();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<GoalFormData>(() => ({
    description: initial?.description ?? "",
    category: initial?.category ?? "Study",
    status: initial?.status ?? "In Progress",
    period: initial?.period ?? "Monthly",
    reference_date: initial?.reference_date ?? formatDateForInput(),
  }));
  const set = <K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.description.trim()) {
      setError("Informe a descrição da meta.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(undefined);
    try {
      if (id) await virtualPlannerApi.updateGoal(Number(id), form);
      else await virtualPlannerApi.createGoal(form);
      navigate("/goals");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a meta.",
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
            placeholder="Ex.: concluir o projeto do semestre"
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
          <Field label="Data de referência">
            <input
              type="date"
              className="input"
              required
              value={form.reference_date}
              onChange={(e) => set("reference_date", e.target.value)}
            />
          </Field>
          <Field label="Período">
            <Select
              value={form.period}
              onChange={(e) => set("period", e.target.value as GoalPeriod)}
            >
              {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriod[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {GOAL_PERIOD_LABELS[value]}
                  </option>
                ),
              )}
            </Select>
          </Field>
          {id && (
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => set("status", e.target.value as GoalStatus)}
              >
                {(Object.keys(GOAL_STATUS_LABELS) as GoalStatus[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {GOAL_STATUS_LABELS[value]}
                    </option>
                  ),
                )}
              </Select>
            </Field>
          )}
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/goals" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : id ? "Salvar alterações" : "Criar meta"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
