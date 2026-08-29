#include "virtual_planner/api/http/routes/reporting_routes.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/json/shared_json.hpp"
#include "virtual_planner/application/reporting/reporting_service.hpp"

#include <chrono>
#include <cstdint>
#include <ctime>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace virtual_planner::api::http {

namespace {

using application::reporting::BucketScore;
using application::reporting::ReportRequest;
using application::reporting::ReportSummary;
using application::reporting::ReportingService;
using Days = std::chrono::sys_days;

Days to_days(const domain::Date& date)
{
    return Days{
        std::chrono::year{static_cast<int>(date.year())} /
        std::chrono::month{date.month()} /
        std::chrono::day{date.day()}};
}

domain::Date from_days(Days days)
{
    const std::chrono::year_month_day date{days};

    return domain::Date{
        static_cast<std::uint32_t>(static_cast<unsigned>(date.day())),
        static_cast<std::uint32_t>(static_cast<unsigned>(date.month())),
        static_cast<std::uint32_t>(static_cast<int>(date.year()))};
}

ReportRequest report_window(std::string_view period,
                            const domain::Date& anchor_date,
                            std::uint64_t user_id)
{
    const Days anchor{to_days(anchor_date)};
    const std::chrono::year_month_day calendar_date{anchor};

    if (period == "weekly")
    {
        const unsigned iso_weekday =
            std::chrono::weekday{anchor}.iso_encoding();
        const Days start =
            anchor - std::chrono::days{static_cast<int>(iso_weekday - 1U)};

        return ReportRequest{from_days(start),
                             from_days(start + std::chrono::days{6}),
                             user_id};
    }

    if (period == "monthly")
    {
        const Days start{
            calendar_date.year() / calendar_date.month() / std::chrono::day{1}};
        const Days end{
            calendar_date.year() / calendar_date.month() / std::chrono::last};

        return ReportRequest{from_days(start), from_days(end), user_id};
    }

    if (period == "yearly")
    {
        const Days start{
            calendar_date.year() / std::chrono::January / std::chrono::day{1}};
        const Days end{
            calendar_date.year() / std::chrono::December / std::chrono::day{31}};

        return ReportRequest{from_days(start), from_days(end), user_id};
    }

    throw std::invalid_argument(
        "Query parameter 'period' must be weekly, monthly or yearly.");
}

std::string required_query_parameter(const httplib::Request& request,
                                     const char* name)
{
    if (!request.has_param(name))
    {
        throw std::invalid_argument(
            "Missing required query parameter: " + std::string{name} + ".");
    }

    return request.get_param_value(name);
}

ReportRequest report_request_from(const httplib::Request& request,
                                  std::uint64_t user_id)
{
    const std::string period = required_query_parameter(request, "period");
    const std::string date = required_query_parameter(request, "date");
    const domain::Date anchor_date = json::date_from_json(date);

    return report_window(period, anchor_date, user_id);
}

domain::Date current_local_date()
{
    const std::time_t now = std::time(nullptr);
    std::tm local_time{};

#if defined(_WIN32)
    if (::localtime_s(&local_time, &now) != 0)
#else
    if (::localtime_r(&now, &local_time) == nullptr)
#endif
    {
        throw std::runtime_error("Could not determine the current local date.");
    }

    return domain::Date{
        static_cast<std::uint32_t>(local_time.tm_mday),
        static_cast<std::uint32_t>(local_time.tm_mon + 1),
        static_cast<std::uint32_t>(local_time.tm_year + 1900)};
}

nlohmann::json optional_ratio(const std::optional<double>& value)
{
    return value.has_value() ? nlohmann::json(*value) : nlohmann::json(nullptr);
}

nlohmann::json bucket_to_json(const BucketScore& bucket)
{
    return {
        {"label", bucket.label},
        {"total", bucket.total},
        {"score", bucket.score},
        {"ratio", optional_ratio(bucket.ratio)},
    };
}

nlohmann::json buckets_to_json(const std::vector<BucketScore>& buckets)
{
    nlohmann::json result = nlohmann::json::array();

    for (const auto& bucket : buckets)
    {
        result.push_back(bucket_to_json(bucket));
    }

    return result;
}

nlohmann::json summary_to_json(const ReportSummary& summary)
{
    return {
        {"start_date", json::to_json(summary.start_date)},
        {"end_date", json::to_json(summary.end_date)},
        {"goals_total", summary.goals_total},
        {"goals_completed", summary.goals_completed},
        {"goals_partially_completed", summary.goals_partially_completed},
        {"goals_ratio", optional_ratio(summary.goals_ratio)},
        {"tasks_total", summary.tasks_total},
        {"tasks_executed", summary.tasks_executed},
        {"tasks_partially_executed", summary.tasks_partially_executed},
        {"tasks_ratio", optional_ratio(summary.tasks_ratio)},
        {"most_productive_weeks",
         buckets_to_json(summary.most_productive_weeks)},
        {"most_productive_months",
         buckets_to_json(summary.most_productive_months)},
        {"most_productive_shifts",
         buckets_to_json(summary.most_productive_shifts)},
        {"task_categories", buckets_to_json(summary.task_categories)},
        {"goal_categories", buckets_to_json(summary.goal_categories)},
        {"productivity_index", optional_ratio(summary.productivity_index)},
    };
}

ReportSummary execute_report(persistence::GoalRepository* goals,
                             persistence::TaskRepository* tasks,
                             const ReportRequest& request)
{
    if (goals == nullptr || tasks == nullptr)
    {
        throw std::logic_error("Reporting repositories are not configured.");
    }

    ReportingService service{*goals, *tasks};
    return service.execute(request);
}

void set_summary_response(httplib::Response& response,
                          const ReportSummary& summary)
{
    response.set_content(summary_to_json(summary).dump(), "application/json");
}

// Dono da requisicao. O gate de autenticacao ja recusou quem nao tem sessao,
// entao chegar aqui sem identidade seria defeito de programacao.
std::uint64_t caller_id(const ApiServer& api, const httplib::Request& request)
{
    const auto user_id = api.authenticated_user_id(request);

    if (!user_id.has_value())
    {
        throw std::logic_error(
            "Reporting route reached without an authenticated caller.");
    }

    return *user_id;
}

} // namespace

void register_reporting_routes(ApiServer& api)
{
    persistence::GoalRepository* goals = api.repositories().goals;
    persistence::TaskRepository* tasks = api.repositories().tasks;

    api.server().Get(
        "/api/reports",
        [&api, goals, tasks](const httplib::Request& request,
                             httplib::Response& response) {
            set_summary_response(
                response,
                execute_report(
                    goals,
                    tasks,
                    report_request_from(request, caller_id(api, request))));
        });

    api.server().Get(
        "/api/dashboard",
        [&api, goals, tasks](const httplib::Request& request,
                             httplib::Response& response) {
            const domain::Date today = current_local_date();
            set_summary_response(
                response,
                execute_report(
                    goals,
                    tasks,
                    ReportRequest{today, today, caller_id(api, request)}));
        });
}

} // namespace virtual_planner::api::http
