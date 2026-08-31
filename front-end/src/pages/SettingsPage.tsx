import {
  PageHeader,
  Card,
  LoadingState,
  ErrorState,
  Button,
} from "../components/ui";
import { virtualPlannerApi } from "../lib/api/virtualPlannerApi";
import { apiBaseUrl } from "../lib/api/config";
import { useApiResource } from "../hooks/useApiResource";

export function SettingsPage() {
  const resource = useApiResource(virtualPlannerApi.getHealth);
  const health = resource.data;
  const rows = health
    ? [
        { label: "Aplicação", value: health.app },
        { label: "Ambiente", value: health.profile },
        { label: "Endereço da API", value: apiBaseUrl },
        {
          label: "Estado da API",
          value: health.status === "ok" ? "Disponível" : "Degradado",
        },
        {
          label: "Banco de dados",
          value: !health.database.configured
            ? "Não configurado — dados temporários em memória"
            : health.database.connected
              ? "Conectado"
              : "Desconectado",
        },
      ]
    : [];
  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Estado atual informado pela API."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={resource.isLoading}
            onClick={resource.retry}
          >
            Atualizar
          </Button>
        }
      />
      {resource.isLoading ? (
        <LoadingState label="Consultando a API…" />
      ) : resource.error ? (
        <ErrorState message={resource.error} onRetry={resource.retry} />
      ) : (
        <Card className="max-w-2xl divide-y divide-border-c overflow-hidden">
          <dl>
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col justify-between gap-2 border-b border-border-c px-4 py-3 text-sm sm:flex-row"
              >
                <dt className="text-muted">{row.label}</dt>
                <dd className="break-all font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      <p className="text-xs text-subtle">
        O tema (claro / escuro / sistema) fica no seletor da barra superior.
      </p>
    </>
  );
}
