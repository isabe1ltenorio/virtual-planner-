import type { RankingEntry } from "../lib/api/reportingApi";
import { formatRankingLabel, formatRatio } from "../lib/formatters";
import { Card, Table } from "./ui";

export function ReportRanking({
  title,
  entries,
}: {
  title: string;
  entries: RankingEntry[];
}) {
  return (
    <Card className="min-w-0 p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      {entries.length === 0 ? (
        <p className="py-4 text-sm text-muted">Sem dados no período.</p>
      ) : (
        <Table
          caption={title}
          headings={["Item", "Total", "Pontuação", "Taxa"]}
        >
          {entries.map((entry) => (
            <tr key={entry.label}>
              <th scope="row" className="px-3 py-2 font-medium text-ink">
                {formatRankingLabel(entry.label)}
              </th>
              <td className="px-3 py-2 tabular-nums">{entry.total}</td>
              <td className="px-3 py-2 tabular-nums">
                {entry.score.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                {formatRatio(entry.ratio)}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
