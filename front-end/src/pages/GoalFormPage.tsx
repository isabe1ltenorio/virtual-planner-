import { useState, useEffect } from "react";
import type { SubmitEvent } from "react";
import { useNavigate, useParams, Link } from "react-router";
import type { Goal, Category, GoalPeriod, GoalStatus } from "../types/domain";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import {
  formatDateForInput,
  CATEGORY_LABELS,
  GOAL_PERIOD_LABELS,
  GOAL_STATUS_LABELS,
} from "../lib/formatters";
import { Button, Field, FormPage } from "../components/ui";

export type GoalFormData = Omit<Goal, "id">;

export function GoalFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [formData, setFormData] = useState<GoalFormData>({
    description: "",
    category: "Study",
    status: "In Progress",
    period: "Monthly",
    reference_date: formatDateForInput(),
  });

  useEffect(() => {
    if (!isEditing || !id) return;
    virtualPlannerApi
      .getGoals()
      .then((goals) => {
        const found = goals.find((g) => g.id === Number(id));
        if (found) {
          setFormData({
            description: found.description,
            category: found.category,
            status: found.status,
            period: found.period,
            reference_date: found.reference_date,
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar meta:", err))
      .finally(() => setIsLoading(false));
  }, [id, isEditing]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing && id) {
        await virtualPlannerApi.updateGoal(Number(id), formData);
      } else {
        await virtualPlannerApi.createGoal(formData);
      }
      navigate("/goals");
    } catch (error) {
      console.error("Erro ao salvar a meta:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormPage
      title={isEditing ? "Editar meta" : "Nova meta"}
      backLink={
        <Link
          to="/goals"
          className="text-sm font-medium text-muted hover:text-ink"
        >
          Voltar
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Descrição">
          <input
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            disabled={isLoading}
            placeholder="Ex.: concluir o projeto do semestre"
            className="input"
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Categoria">
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
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

          <Field label="Data de referência">
            <input
              type="date"
              name="reference_date"
              value={formData.reference_date}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="input"
            />
          </Field>

          <Field label="Período">
            <select
              name="period"
              value={formData.period}
              onChange={handleChange}
              disabled={isLoading}
              className="select"
            >
              {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                <option key={p} value={p}>
                  {GOAL_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={isLoading}
              className="select"
            >
              {(Object.keys(GOAL_STATUS_LABELS) as GoalStatus[]).map((s) => (
                <option key={s} value={s}>
                  {GOAL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border-c pt-4">
          <Link to="/goals" className="btn btn-ghost">
            Cancelar
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Salvando…"
              : isEditing
                ? "Salvar alterações"
                : "Criar meta"}
          </Button>
        </div>
      </form>
    </FormPage>
  );
}
