import { useCallback, useState } from "react";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import type { GoalPeriodFilter } from "../lib/api/goalsApi";
import { useApiResource } from "../hooks/useApiResource";
import { formatDateForInput, formatRatio } from "../lib/formatters";
import {
  Card,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
} from "../components/ui";
import { ReportRanking } from "../components/ReportRanking";

function ProgressRow({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number | null;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">
          {formatRatio(ratio)}
        </span>
      </div>
      {ratio !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
      <p className="mt-1 text-xs text-subtle">{detail}</p>
    </div>
  );
}

export function ReportsPage() {
  const [period, setPeriod] = useState<GoalPeriodFilter>("weekly");
  const [date, setDate] = useState(formatDateForInput());
  const load = useCallback(
    () => virtualPlannerApi.getReport(period, date),
    [period, date],
  );
  const resource = useApiResource(load);
  const report = resource.data;
  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Métricas calculadas pelo servidor para o período selecionado."
      />
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Período">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as GoalPeriodFilter)}
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </Select>
        </Field>
        <Field label="Data de referência">
          <input
            type="date"
            className="input"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </Card>
      {resource.isLoading ? (
        <LoadingState label="Carregando relatório…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        report && (
          <>
            <p className="text-sm text-muted">
              De{" "}
              {new Date(`${report.start_date}T00:00:00`).toLocaleDateString(
                "pt-BR",
              )}{" "}
              a{" "}
              {new Date(`${report.end_date}T00:00:00`).toLocaleDateString(
                "pt-BR",
              )}
              .
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Índice de produtividade"
                value={formatRatio(report.productivity_index)}
              />
              <StatCard label="Tarefas no período" value={report.tasks_total} />
              <StatCard label="Metas no período" value={report.goals_total} />
            </div>
            <Card className="grid gap-6 p-6 sm:grid-cols-2">
              <ProgressRow
                label="Metas cumpridas"
                ratio={report.goals_ratio}
                detail={`${report.goals_completed} cumpridas e ${report.goals_partially_completed} parciais de ${report.goals_total}`}
              />
              <ProgressRow
                label="Tarefas executadas"
                ratio={report.tasks_ratio}
                detail={`${report.tasks_executed} executadas e ${report.tasks_partially_executed} parciais de ${report.tasks_total}`}
              />
            </Card>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ReportRanking
                title="Semanas mais produtivas"
                entries={report.most_productive_weeks}
              />
              <ReportRanking
                title="Meses mais produtivos"
                entries={report.most_productive_months}
              />
              <ReportRanking
                title="Turnos mais produtivos"
                entries={report.most_productive_shifts}
              />
              <ReportRanking
                title="Categorias — tarefas"
                entries={report.task_categories}
              />
              <ReportRanking
                title="Categorias — metas"
                entries={report.goal_categories}
              />
            </div>
          </>
        )
      )}
    </>
  );
}
