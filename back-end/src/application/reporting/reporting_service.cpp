#include "virtual_planner/application/reporting/reporting_service.hpp"

#include <algorithm>
#include <array>
#include <chrono>
#include <iomanip>
#include <map>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace virtual_planner::application::reporting {

namespace {

using Days = std::chrono::sys_days;

Days to_system_days(const domain::Date& date)
{
    return Days{
        std::chrono::year{static_cast<int>(date.year())} /
        std::chrono::month{date.month()} /
        std::chrono::day{date.day()}};
}

bool within(const domain::Date& value,
            const domain::Date& start,
            const domain::Date& end)
{
    return value >= start && value <= end;
}

// Pesos do contrato: o status parcial vale meio. Tudo que nao foi concluido
// vale zero e PERMANECE no denominador — se Cancelled saisse da conta,
// cancelar tudo daria 100%.
double weight_of(domain::GoalStatus status)
{
    switch (status)
    {
        case domain::GoalStatus::Completed:
            return 1.0;

        case domain::GoalStatus::PartiallyCompleted:
            return 0.5;

        case domain::GoalStatus::InProgress:
        case domain::GoalStatus::Failed:
            return 0.0;
    }

    return 0.0;
}

double weight_of(domain::TaskStatus status)
{
    switch (status)
    {
        case domain::TaskStatus::Executed:
            return 1.0;

        case domain::TaskStatus::PartiallyExecuted:
            return 0.5;

        case domain::TaskStatus::Pending:
        case domain::TaskStatus::Cancelled:
        case domain::TaskStatus::Postponed:
            return 0.0;
    }

    return 0.0;
}

// Semana ISO 8601: a semana 1 e a que contem a primeira quinta-feira do ano, e
// o ano do rotulo e o ano dessa quinta — por isso 31/12 pode cair na semana 1
// do ano seguinte. Rotulo "YYYY-Www", com zero a esquerda para que a ordem
// lexicografica coincida com a cronologica.
std::string iso_week_label(const domain::Date& date)
{
    const Days day = to_system_days(date);
    const auto weekday = std::chrono::weekday{day};
    const auto iso_day = static_cast<int>(weekday.iso_encoding()); // seg=1..dom=7
    const Days thursday = day + std::chrono::days{4 - iso_day};

    const std::chrono::year_month_day thursday_date{thursday};
    const auto iso_year = thursday_date.year();
    const Days january_first{iso_year / std::chrono::January / 1};

    const auto week = ((thursday - january_first).count() / 7) + 1;

    std::ostringstream stream;
    stream << std::setfill('0')
           << std::setw(4) << static_cast<int>(iso_year)
           << "-W"
           << std::setw(2) << week;

    return stream.str();
}

std::string month_label(const domain::Date& date)
{
    std::ostringstream stream;
    stream << std::setfill('0')
           << std::setw(4) << date.year()
           << '-'
           << std::setw(2) << date.month();

    return stream.str();
}

struct Accumulator
{
    std::uint32_t total{0};
    double score{0.0};
};

void accumulate(std::map<std::string, Accumulator>& buckets,
                const std::string& label,
                double weight)
{
    auto& bucket = buckets[label];
    bucket.total += 1;
    bucket.score += weight;
}

std::optional<double> ratio_of(double score, std::uint32_t total)
{
    if (total == 0)
    {
        return std::nullopt;
    }

    return score / static_cast<double>(total);
}

BucketScore to_bucket(const std::string& label, const Accumulator& accumulator)
{
    return BucketScore{
        label,
        accumulator.total,
        accumulator.score,
        ratio_of(accumulator.score, accumulator.total)};
}

// Devolve apenas os baldes de score maximo, preservando a ordem recebida —
// que e cronologica para semanas, meses e turnos.
//
// A comparacao por igualdade de double e segura aqui: todo score e uma soma de
// 0,5 e 1,0, ambos exatos em binario, entao nao ha erro de arredondamento a
// acumular.
std::vector<BucketScore> most_productive(const std::vector<BucketScore>& buckets)
{
    double best = 0.0;

    for (const auto& bucket : buckets)
    {
        best = std::max(best, bucket.score);
    }

    // Score maximo zero significa que nada foi executado. Devolver "todos
    // empatados em zero" seria pior que devolver vazio.
    if (best <= 0.0)
    {
        return {};
    }

    std::vector<BucketScore> result;

    for (const auto& bucket : buckets)
    {
        if (bucket.score == best)
        {
            result.push_back(bucket);
        }
    }

    return result;
}

std::vector<BucketScore> ordered_buckets(
    const std::map<std::string, Accumulator>& buckets)
{
    std::vector<BucketScore> result;
    result.reserve(buckets.size());

    for (const auto& [label, accumulator] : buckets)
    {
        result.push_back(to_bucket(label, accumulator));
    }

    return result;
}

// Categorias saem por score decrescente. O desempate por rotulo existe so para
// a saida ser deterministica: sem ele, duas execucoes com o mesmo dado
// poderiam ordenar diferente e quebrar teste.
std::vector<BucketScore> by_score_desc(std::vector<BucketScore> buckets)
{
    std::sort(buckets.begin(), buckets.end(),
              [](const BucketScore& left, const BucketScore& right) {
                  if (left.score != right.score)
                  {
                      return left.score > right.score;
                  }

                  return left.label < right.label;
              });

    return buckets;
}

} // namespace

ReportSummary::ReportSummary(domain::Date start, domain::Date end)
    : start_date(start), end_date(end)
{
}

domain::Shift shift_of(const domain::TimeSlot& time_slot)
{
    const auto start = time_slot.start();

    if (start < std::chrono::hours{12})
    {
        return domain::Shift::Morning;
    }

    if (start < std::chrono::hours{18})
    {
        return domain::Shift::Afternoon;
    }

    return domain::Shift::Evening;
}

ReportingService::ReportingService(persistence::GoalRepository& goals,
                                   persistence::TaskRepository& tasks)
    : goals_(goals), tasks_(tasks)
{
}

ReportSummary ReportingService::execute(const ReportRequest& request) const
{
    if (request.start_date > request.end_date)
    {
        throw std::invalid_argument(
            "O inicio do periodo do relatorio nao pode ser posterior ao fim.");
    }

    ReportSummary summary{request.start_date, request.end_date};

    // --- Metas -------------------------------------------------------------
    //
    // Uma Goal conta UMA vez, pela reference_date, mesmo quando period e
    // Weekly: ela e uma entidade, nao uma serie.
    double goals_score = 0.0;
    std::map<std::string, Accumulator> goal_categories;

    for (const auto& goal : goals_.find_all(request.user_id))
    {
        if (!within(goal.reference_date(), request.start_date, request.end_date))
        {
            continue;
        }

        const double weight = weight_of(goal.status());

        summary.goals_total += 1;
        goals_score += weight;

        if (goal.status() == domain::GoalStatus::Completed)
        {
            summary.goals_completed += 1;
        }
        else if (goal.status() == domain::GoalStatus::PartiallyCompleted)
        {
            summary.goals_partially_completed += 1;
        }

        accumulate(goal_categories, domain::to_string(goal.category()), weight);
    }

    summary.goals_ratio = ratio_of(goals_score, summary.goals_total);
    summary.goal_categories = by_score_desc(ordered_buckets(goal_categories));

    // --- Tarefas -----------------------------------------------------------
    double tasks_score = 0.0;
    std::map<std::string, Accumulator> weeks;
    std::map<std::string, Accumulator> months;
    std::map<std::string, Accumulator> task_categories;
    std::array<Accumulator, 3> shifts{};

    for (const auto& task : tasks_.find_all(request.user_id))
    {
        if (!within(task.date(), request.start_date, request.end_date))
        {
            continue;
        }

        const double weight = weight_of(task.status());

        summary.tasks_total += 1;
        tasks_score += weight;

        if (task.status() == domain::TaskStatus::Executed)
        {
            summary.tasks_executed += 1;
        }
        else if (task.status() == domain::TaskStatus::PartiallyExecuted)
        {
            summary.tasks_partially_executed += 1;
        }

        accumulate(weeks, iso_week_label(task.date()), weight);
        accumulate(months, month_label(task.date()), weight);
        accumulate(task_categories, domain::to_string(task.category()), weight);

        auto& shift = shifts[static_cast<std::size_t>(shift_of(task.time_slot()))];
        shift.total += 1;
        shift.score += weight;
    }

    summary.tasks_ratio = ratio_of(tasks_score, summary.tasks_total);
    summary.task_categories = by_score_desc(ordered_buckets(task_categories));

    // Semanas e meses saem do std::map ja em ordem cronologica, porque os
    // rotulos tem zero a esquerda.
    summary.most_productive_weeks = most_productive(ordered_buckets(weeks));
    summary.most_productive_months = most_productive(ordered_buckets(months));

    // Turnos nao podem sair do map: a ordem cronologica deles e Morning,
    // Afternoon, Evening, e nao a alfabetica dos rotulos.
    std::vector<BucketScore> shift_buckets;

    for (std::size_t index = 0; index < shifts.size(); ++index)
    {
        if (shifts[index].total == 0)
        {
            continue;
        }

        shift_buckets.push_back(
            to_bucket(domain::to_string(static_cast<domain::Shift>(index)),
                      shifts[index]));
    }

    summary.most_productive_shifts = most_productive(shift_buckets);

    // --- Indicador geral ---------------------------------------------------
    if (summary.goals_ratio.has_value() && summary.tasks_ratio.has_value())
    {
        summary.productivity_index =
            0.5 * *summary.goals_ratio + 0.5 * *summary.tasks_ratio;
    }
    else if (summary.goals_ratio.has_value())
    {
        summary.productivity_index = summary.goals_ratio;
    }
    else if (summary.tasks_ratio.has_value())
    {
        summary.productivity_index = summary.tasks_ratio;
    }

    return summary;
}

} // namespace virtual_planner::application::reporting
