#include "virtual_planner/api/http/routes/goal_routes.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/json/goal_json.hpp"
#include "virtual_planner/api/json/shared_json.hpp"
#include "virtual_planner/application/goal/create_goal_use_case.hpp"
#include "virtual_planner/application/goal/get_goal_use_case.hpp"
#include "virtual_planner/application/goal/list_goals_use_case.hpp"
#include "virtual_planner/application/goal/update_goal_use_case.hpp"
#include "virtual_planner/application/goal/change_goal_status_use_case.hpp"
#include "virtual_planner/application/goal/delete_goal_use_case.hpp"

#include <chrono>
#include <cstdint>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>
#include <string_view>

namespace virtual_planner::api::http {

namespace {

using Days = std::chrono::sys_days;

std::uint64_t path_id(const httplib::Request& request)
{
    try
    {
        const std::string value = request.matches[1].str();

        std::size_t parsed = 0;
        const auto id = std::stoull(value, &parsed);

        if (parsed != value.size())
        {
            throw std::invalid_argument("Invalid goal id.");
        }

        return id;
    }
    catch (const std::invalid_argument&)
    {
        throw std::invalid_argument("Invalid goal id.");
    }
    catch (const std::out_of_range&)
    {
        throw std::invalid_argument("Invalid goal id.");
    }
}

Days to_days(const domain::Date& date)
{
    return Days{
        std::chrono::year{
            static_cast<int>(date.year())} /
        std::chrono::month{
            date.month()} /
        std::chrono::day{
            date.day()}};
}

domain::Date from_days(Days days)
{
    const std::chrono::year_month_day date{days};

    return domain::Date{
        static_cast<std::uint32_t>(
            static_cast<unsigned>(date.day())),
        static_cast<std::uint32_t>(
            static_cast<unsigned>(date.month())),
        static_cast<std::uint32_t>(
            static_cast<int>(date.year()))};
}

struct GoalWindow
{
    domain::Date start;
    domain::Date end;
};

GoalWindow goal_window(
    std::string_view period,
    const domain::Date& anchor_date)
{
    const Days anchor{to_days(anchor_date)};

    const std::chrono::year_month_day calendar_date{
        anchor};

    if (period == "weekly")
    {
        const unsigned iso_weekday =
            std::chrono::weekday{
                anchor}
                .iso_encoding();

        const Days start =
            anchor -
            std::chrono::days{
                static_cast<int>(
                    iso_weekday - 1U)};

        return {
            from_days(start),
            from_days(
                start +
                std::chrono::days{6})};
    }

    if (period == "monthly")
    {
        const Days start{
            calendar_date.year() /
            calendar_date.month() /
            std::chrono::day{1}};

        const Days end{
            calendar_date.year() /
            calendar_date.month() /
            std::chrono::last};

        return {
            from_days(start),
            from_days(end)};
    }

    if (period == "yearly")
    {
        const Days start{
            calendar_date.year() /
            std::chrono::January /
            std::chrono::day{1}};

        const Days end{
            calendar_date.year() /
            std::chrono::December /
            std::chrono::day{31}};

        return {
            from_days(start),
            from_days(end)};
    }

    throw std::invalid_argument(
        "Query parameter 'period' must be weekly, monthly or yearly.");
}

std::string required_query_parameter(
    const httplib::Request& request,
    const char* name)
{
    if (!request.has_param(name))
    {
        throw std::invalid_argument(
            "Missing required query parameter: " +
            std::string{name} + ".");
    }

    return request.get_param_value(name);
}

GoalWindow goal_window_from(
    const httplib::Request& request)
{
    const std::string period =
        required_query_parameter(
            request,
            "period");

    const std::string date =
        required_query_parameter(
            request,
            "date");

    const domain::Date anchor_date =
        json::date_from_json(date);

    return goal_window(
        period,
        anchor_date);
}

const nlohmann::json& required_field(
    const nlohmann::json& value,
    const char* field)
{
    if (!value.contains(field))
    {
        throw std::invalid_argument(
            std::string{
                "Goal requires the field \""} +
            field +
            "\".");
    }

    return value.at(field);
}

nlohmann::json parse_json_body(
    const httplib::Request& request)
{
    try
    {
        const auto body =
            nlohmann::json::parse(
                request.body);

        if (!body.is_object())
        {
            throw std::invalid_argument(
                "Goal payload must be a JSON object.");
        }

        return body;
    }
    catch (const nlohmann::json::exception&)
    {
        throw std::invalid_argument(
            "Invalid JSON payload.");
    }
}

application::CreateGoalRequest create_goal_request_from(
    const httplib::Request& request)
{
    const auto body =
        parse_json_body(request);

    const auto& description =
        required_field(
            body,
            "description");

    if (!description.is_string())
    {
        throw std::invalid_argument(
            "Goal field \"description\" must be a string.");
    }

    return application::CreateGoalRequest{
        description.get<std::string>(),
        json::category_from_json(
            required_field(
                body,
                "category")),
        json::goal_period_from_json(
            required_field(
                body,
                "period")),
        json::date_from_json(
            required_field(
                body,
                "reference_date"))};
}

application::UpdateGoalRequest update_goal_request_from(
    const httplib::Request& request,
    const domain::Goal& current_goal)
{
    const auto body =
        parse_json_body(request);

    std::string description =
        current_goal.description();

    domain::Category category =
        current_goal.category();

    domain::GoalPeriod period =
        current_goal.period();

    domain::Date reference_date =
        current_goal.reference_date();

    if (body.contains("description"))
    {
        const auto& value =
            body.at("description");

        if (!value.is_string())
        {
            throw std::invalid_argument(
                "Goal field \"description\" must be a string.");
        }

        description =
            value.get<std::string>();
    }

    if (body.contains("category"))
    {
        category =
            json::category_from_json(
                body.at("category"));
    }

    if (body.contains("period"))
    {
        period =
            json::goal_period_from_json(
                body.at("period"));
    }

    if (body.contains("reference_date"))
    {
        reference_date =
            json::date_from_json(
                body.at("reference_date"));
    }

    return application::UpdateGoalRequest{
        current_goal.id(),
        description,
        category,
        period,
        reference_date};
}

application::ChangeGoalStatusRequest change_goal_status_request_from(
    const httplib::Request& request,
    std::uint64_t id)
{
    const auto body =
        parse_json_body(request);

    return application::ChangeGoalStatusRequest{
        id,
        json::goal_status_from_json(
            required_field(
                body,
                "status"))};
}

// Dono da requisicao. O gate de autenticacao (ApiServer::register_authentication_gate)
// ja respondeu 401 a quem nao tem sessao valida, entao chegar aqui sem
// identidade seria defeito de programacao — uma rota registrada como publica
// por engano, por exemplo. Falhar alto e melhor que operar sobre dono zero.
std::uint64_t caller_id(const ApiServer& api, const httplib::Request& request)
{
    const auto user_id = api.authenticated_user_id(request);

    if (!user_id.has_value())
    {
        throw std::logic_error(
            "Goal route reached without an authenticated caller.");
    }

    return *user_id;
}

} // namespace

void register_goal_routes(ApiServer& api)
{
    persistence::GoalRepository* goals =
        api.repositories().goals;

    if (goals == nullptr)
    {
        throw std::logic_error(
            "Goal repository is not configured.");
    }

    // POST /api/goals
    api.server().Post(
        "/api/goals",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            const std::uint64_t user_id = caller_id(api, request);

            const application::CreateGoalRequest
                create_request =
                    create_goal_request_from(
                        request);

            application::CreateGoalUseCase
                create_use_case{
                    *goals};

            const std::uint64_t id =
                create_use_case.execute(
                    create_request,
                    user_id);

            application::GetGoalUseCase
                get_use_case{
                    *goals};

            const domain::Goal created_goal =
                get_use_case.execute(id, user_id);

            response.status = 201;

            response.set_header(
                "Location",
                "/api/goals/" +
                    std::to_string(id));

            response.set_content(
                json::to_json(
                    created_goal)
                    .dump(),
                "application/json");
        });

    // PATCH /api/goals/:id
    api.server().Patch(
        R"(/api/goals/(\d+))",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            const std::uint64_t id =
                path_id(request);
            const std::uint64_t user_id = caller_id(api, request);

            application::GetGoalUseCase
                get_use_case{
                    *goals};

            const domain::Goal current_goal =
                get_use_case.execute(id, user_id);

            const application::UpdateGoalRequest
                update_request =
                    update_goal_request_from(
                        request,
                        current_goal);

            application::UpdateGoalUseCase
                update_use_case{
                    *goals};

            update_use_case.execute(
                update_request,
                user_id);

            const domain::Goal updated_goal =
                get_use_case.execute(id, user_id);

            response.set_content(
                json::to_json(updated_goal).dump(),
                "application/json");
        });

    // PATCH /api/goals/:id/status
    api.server().Patch(
        R"(/api/goals/(\d+)/status)",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            const std::uint64_t id =
                path_id(request);
            const std::uint64_t user_id = caller_id(api, request);

            const application::ChangeGoalStatusRequest
                status_request =
                    change_goal_status_request_from(
                        request,
                        id);

            application::ChangeGoalStatusUseCase
                use_case{
                    *goals};

            use_case.execute(
                status_request,
                user_id);

            application::GetGoalUseCase
                get_use_case{
                    *goals};

            const domain::Goal updated_goal =
                get_use_case.execute(id, user_id);

            response.set_content(
                json::to_json(updated_goal).dump(),
                "application/json");
        });

    // DELETE /api/goals/:id
    api.server().Delete(
        R"(/api/goals/(\d+))",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            const std::uint64_t id =
                path_id(request);
            const std::uint64_t user_id = caller_id(api, request);

            application::DeleteGoalUseCase use_case{
                *goals};

            use_case.execute(id, user_id);

            response.status = 204;
        });

    // GET /api/goals?period=weekly&date=2026-08-05
    api.server().Get(
        "/api/goals",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            const GoalWindow window =
                goal_window_from(
                    request);
            const std::uint64_t user_id = caller_id(api, request);

            application::ListGoalsUseCase
                use_case{
                    *goals};

            const auto goal_list =
                use_case.execute(
                    window.start,
                    window.end,
                    user_id);

            nlohmann::json body =
                nlohmann::json::array();

            for (const auto& goal : goal_list)
            {
                body.push_back(
                    json::to_json(goal));
            }

            response.set_content(
                body.dump(),
                "application/json");
        });

    // GET /api/goals/:id
    api.server().Get(
        R"(/api/goals/(\d+))",
        [&api, goals](
            const httplib::Request& request,
            httplib::Response& response) {
            application::GetGoalUseCase
                use_case{
                    *goals};

            const domain::Goal goal =
                use_case.execute(
                    path_id(request),
                    caller_id(api, request));

            response.set_content(
                json::to_json(goal).dump(),
                "application/json");
        });
    }

} // namespace virtual_planner::api::http
