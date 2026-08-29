#pragma once

// Servico de relatorios e estatisticas (issue #45 / P-23).
//
// Implementa exatamente as formulas de docs/reporting-metrics-contract.md
// (P-63). Se este codigo divergir daquele documento, o errado e este codigo.
//
// O servico le repositorios e nao conhece SQL nem HTTP. Os endpoints sao a
// P-34, e a camada HTTP nao pode recalcular metrica nenhuma: ela serializa o
// que vem daqui.

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "virtual_planner/domain/enums/shift.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/domain/value_objects/time_slot.hpp"
#include "virtual_planner/persistence/goal_repository.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application::reporting {

struct ReportRequest
{
    // Intervalo inclusivo nas duas pontas.
    domain::Date start_date;
    domain::Date end_date;

    // Dono do relatorio. Sem ele o servico somava a base inteira e devolvia o
    // resultado a qualquer chamador (issue #113): mesmo sem ler o registro
    // alheio, quem chamasse aprendia quantas metas existem, de que categorias e
    // em que turnos. E campo obrigatorio de proposito — nao ha valor padrao que
    // signifique "todo mundo".
    std::uint64_t user_id;
};

// Um balde agregado: semana, mes, turno ou categoria.
struct BucketScore
{
    std::string label;          // "2026-W35", "2026-08", "Morning", "Study"
    std::uint32_t total{0};     // itens no balde
    double score{0.0};          // soma dos pesos
    std::optional<double> ratio; // score / total; nullopt quando total == 0
};

struct ReportSummary
{
    ReportSummary(domain::Date start, domain::Date end);

    domain::Date start_date;
    domain::Date end_date;

    std::uint32_t goals_total{0};
    std::uint32_t goals_completed{0};
    std::uint32_t goals_partially_completed{0};
    // nullopt quando nao ha meta no periodo. NAO e zero: zero significa que
    // havia o que medir e nao foi cumprido.
    std::optional<double> goals_ratio;

    std::uint32_t tasks_total{0};
    std::uint32_t tasks_executed{0};
    std::uint32_t tasks_partially_executed{0};
    std::optional<double> tasks_ratio;

    // Apenas os baldes de score maximo, todos os empatados, em ordem
    // cronologica. Vazio quando nada foi executado no periodo.
    std::vector<BucketScore> most_productive_weeks;
    std::vector<BucketScore> most_productive_months;
    std::vector<BucketScore> most_productive_shifts;

    // Todas as categorias presentes no periodo, inclusive com score zero,
    // ordenadas por score decrescente.
    std::vector<BucketScore> task_categories;
    std::vector<BucketScore> goal_categories;

    std::optional<double> productivity_index;
};

// Turno derivado do inicio do TimeSlot, enquanto Task nao tiver turno proprio
// (lacuna A da P-62; a #34 fechou sem entregar). Uma tarefa que atravessa
// turnos conta apenas no turno em que comeca.
//
//   Morning   [00:00, 12:00)
//   Afternoon [12:00, 18:00)
//   Evening   [18:00, 24:00)
[[nodiscard]] domain::Shift shift_of(const domain::TimeSlot& time_slot);

class ReportingService
{
public:
    ReportingService(persistence::GoalRepository& goals,
                     persistence::TaskRepository& tasks);

    // Lanca std::invalid_argument quando start_date > end_date, como
    // ListRemindersUseCase.
    [[nodiscard]] ReportSummary execute(const ReportRequest& request) const;

private:
    persistence::GoalRepository& goals_;
    persistence::TaskRepository& tasks_;
};

} // namespace virtual_planner::application::reporting
