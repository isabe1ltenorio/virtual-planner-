import { PageHeader, Card } from "../components/ui";

const INFO: { label: string; value: string }[] = [
  { label: "Aplicação", value: "Taskly" },
  { label: "Versão", value: "1.0.0" },
  { label: "Armazenamento", value: "PostgreSQL / mock local" },
];

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Informações da aplicação." />

      <Card className="max-w-md divide-y divide-border-c overflow-hidden">
        {INFO.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-muted">{row.label}</span>
            <span className="font-medium text-ink">{row.value}</span>
          </div>
        ))}
      </Card>

      <p className="text-xs text-subtle">
        O tema (claro / escuro / sistema) fica no seletor da barra superior.
      </p>
    </>
  );
}
