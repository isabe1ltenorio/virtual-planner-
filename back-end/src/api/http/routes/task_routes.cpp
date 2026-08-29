#include "virtual_planner/api/http/routes/task_routes.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/json/shared_json.hpp"
#include "virtual_planner/api/json/task_json.hpp"
#include "virtual_planner/application/task/change_task_status_use_case.hpp"
#include "virtual_planner/application/task/create_task_use_case.hpp"
#include "virtual_planner/application/task/delete_task_use_case.hpp"
#include "virtual_planner/application/task/get_task_use_case.hpp"
#include "virtual_planner/application/task/list_tasks_use_case.hpp"
#include "virtual_planner/application/task/update_task_use_case.hpp"

#include <cstddef>
#include <cstdint>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>

namespace virtual_planner::api::http {

namespace {

std::uint64_t path_id(const httplib::Request& request)
{
    try
    {
        const std::string value = request.matches[1].str();

        std::size_t parsed = 0;
        const auto id = std::stoull(value, &parsed);

        if (parsed != value.size())
        {
            throw std::invalid_argument("Invalid task id.");
        }

        return id;
    }
    catch (const std::invalid_argument&)
    {
        throw std::invalid_argument("Invalid task id.");
    }
    catch (const std::out_of_range&)
    {
        throw std::invalid_argument("Invalid task id.");
    }
}

const nlohmann::json& required_field(const nlohmann::json& value,
                                     const char* field)
{
    if (!value.contains(field))
    {
        throw std::invalid_argument(
            std::string{"Task requires the field \""} + field + "\".");
    }

    return value.at(field);
}

nlohmann::json parse_json_body(const httplib::Request& request)
{
    try
    {
        auto body = nlohmann::json::parse(request.body);

        if (!body.is_object())
        {
            throw std::invalid_argument("Task payload must be a JSON object.");
        }

        return body;
    }
    catch (const nlohmann::json::exception&)
    {
        throw std::invalid_argument("Invalid JSON payload.");
    }
}

std::string read_string_field(const nlohmann::json& body, const char* field)
{
    const nlohmann::json& value = required_field(body, field);

    if (!value.is_string())
    {
        throw std::invalid_argument(
            std::string{"Task field \""} + field + "\" must be a string.");
    }

    return value.get<std::string>();
}

application::CreateTaskRequest create_task_request_from(
    const httplib::Request& request)
{
    const auto body = parse_json_body(request);

    return application::CreateTaskRequest{
        read_string_field(body, "description"),
        json::category_from_json(required_field(body, "category")),
        json::date_from_json(required_field(body, "date")),
        json::time_slot_from_json(required_field(body, "time_slot")),
        json::priority_from_json(required_field(body, "priority"))};
}

application::UpdateTaskRequest update_task_request_from(
    const httplib::Request& request,
    const domain::Task& current)
{
    const auto body = parse_json_body(request);

    std::string description = current.description();
    domain::Category category = current.category();
    domain::Date date = current.date();
    domain::TimeSlot time_slot = current.time_slot();
    domain::Priority priority = current.priority();

    if (body.contains("description"))
    {
        const auto& value = body.at("description");

        if (!value.is_string())
        {
            throw std::invalid_argument(
                "Task field \"description\" must be a string.");
        }

        description = value.get<std::string>();
    }

    if (body.contains("category"))
    {
        category = json::category_from_json(body.at("category"));
    }

    if (body.contains("date"))
    {
        date = json::date_from_json(body.at("date"));
    }

    if (body.contains("time_slot"))
    {
        time_slot = json::time_slot_from_json(body.at("time_slot"));
    }

    if (body.contains("priority"))
    {
        priority = json::priority_from_json(body.at("priority"));
    }

    return application::UpdateTaskRequest{
        current.id(), description, category, date, time_slot, priority};
}

application::ChangeTaskStatusRequest change_task_status_request_from(
    const httplib::Request& request,
    std::uint64_t id)
{
    const auto body = parse_json_body(request);

    return application::ChangeTaskStatusRequest{
        id, json::task_status_from_json(required_field(body, "status"))};
}

// Todos os filtros sao opcionais e combinam com AND. Um valor malformado
// (data, categoria, prioridade ou status) faz o parser compartilhado lancar
// std::invalid_argument, que o handler de excecao mapeia para 400 (P-35).
application::ListTasksFilter list_tasks_filter_from(
    const httplib::Request& request)
{
    application::ListTasksFilter filter;

    if (request.has_param("start_date"))
    {
        filter.start_date =
            json::date_from_json(request.get_param_value("start_date"));
    }

    if (request.has_param("end_date"))
    {
        filter.end_date =
            json::date_from_json(request.get_param_value("end_date"));
    }

    if (request.has_param("category"))
    {
        filter.category =
            json::category_from_json(request.get_param_value("category"));
    }

    if (request.has_param("priority"))
    {
        filter.priority =
            json::priority_from_json(request.get_param_value("priority"));
    }

    if (request.has_param("status"))
    {
        filter.status =
            json::task_status_from_json(request.get_param_value("status"));
    }

    return filter;
}

} // namespace

void register_task_routes(ApiServer& api)
{
    persistence::TaskRepository* tasks = api.repositories().tasks;

    if (tasks == nullptr)
    {
        throw std::logic_error("Task repository is not configured.");
    }

    // POST /api/tasks
    api.server().Post(
        "/api/tasks",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            application::CreateTaskUseCase create{*tasks};
            const std::uint64_t id =
                create.execute(create_task_request_from(request));

            application::GetTaskUseCase get{*tasks};
            const domain::Task created = get.execute(id);

            response.status = 201;
            response.set_header("Location", "/api/tasks/" + std::to_string(id));
            response.set_content(json::to_json(created).dump(),
                                 "application/json");
        });

    // GET /api/tasks?start_date=&end_date=&category=&priority=&status=
    api.server().Get(
        "/api/tasks",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            application::ListTasksUseCase list{*tasks};
            const auto result = list.execute(list_tasks_filter_from(request));

            nlohmann::json body = nlohmann::json::array();

            for (const auto& task : result)
            {
                body.push_back(json::to_json(task));
            }

            response.set_content(body.dump(), "application/json");
        });

    // GET /api/tasks/:id
    api.server().Get(
        R"(/api/tasks/(\d+))",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            application::GetTaskUseCase get{*tasks};
            const domain::Task task = get.execute(path_id(request));

            response.set_content(json::to_json(task).dump(), "application/json");
        });

    // PATCH /api/tasks/:id
    api.server().Patch(
        R"(/api/tasks/(\d+))",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            const std::uint64_t id = path_id(request);

            application::GetTaskUseCase get{*tasks};
            const domain::Task current = get.execute(id);

            application::UpdateTaskUseCase update{*tasks};
            update.execute(update_task_request_from(request, current));

            const domain::Task updated = get.execute(id);
            response.set_content(json::to_json(updated).dump(),
                                 "application/json");
        });

    // PATCH /api/tasks/:id/status
    api.server().Patch(
        R"(/api/tasks/(\d+)/status)",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            const std::uint64_t id = path_id(request);

            application::ChangeTaskStatusUseCase change{*tasks};
            change.execute(change_task_status_request_from(request, id));

            application::GetTaskUseCase get{*tasks};
            const domain::Task updated = get.execute(id);
            response.set_content(json::to_json(updated).dump(),
                                 "application/json");
        });

    // DELETE /api/tasks/:id
    api.server().Delete(
        R"(/api/tasks/(\d+))",
        [tasks](const httplib::Request& request, httplib::Response& response) {
            application::DeleteTaskUseCase remove{*tasks};
            remove.execute(path_id(request));

            response.status = 204;
        });
}

} // namespace virtual_planner::api::http
