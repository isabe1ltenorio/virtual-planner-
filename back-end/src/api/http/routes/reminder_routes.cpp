#include "virtual_planner/api/http/routes/reminder_routes.hpp"

#include "virtual_planner/shared/errors.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/json/reminder_json.hpp"
#include "virtual_planner/api/json/shared_json.hpp"
#include "virtual_planner/application/reminder/create_reminder_use_case.hpp"
#include "virtual_planner/application/reminder/delete_reminder_use_case.hpp"
#include "virtual_planner/application/reminder/list_reminders_use_case.hpp"
#include "virtual_planner/application/reminder/update_reminder_use_case.hpp"

#include <charconv>
#include <cstdint>
#include <nlohmann/json.hpp>
#include <optional>
#include <stdexcept>
#include <string>
#include <system_error>

namespace virtual_planner::api::http {

namespace {

std::string required_query_parameter(const httplib::Request& request,
                                     const char* name)
{
    if (!request.has_param(name))
    {
        throw std::invalid_argument(
            "Parâmetro de query obrigatório ausente: " +
            std::string{name} + ".");
    }

    return request.get_param_value(name);
}

std::uint64_t path_id_from(const httplib::Request& request)
{
    const std::string text = request.matches.size() > 1
        ? request.matches[1].str()
        : std::string{};

    if (text.empty())
    {
        throw std::invalid_argument("O ID do lembrete é obrigatório.");
    }

    std::uint64_t id{};
    const char* const first = text.data();
    const char* const last = first + text.size();
    const auto result = std::from_chars(first, last, id);

    if (result.ec != std::errc{} || result.ptr != last)
    {
        throw std::invalid_argument(
            "O ID do lembrete deve ser um inteiro sem sinal válido.");
    }

    return id;
}

nlohmann::json parse_request_body(const httplib::Request& request)
{
    try
    {
        return nlohmann::json::parse(request.body);
    }
    catch (const nlohmann::json::parse_error&)
    {
        throw std::invalid_argument("O corpo da requisição contém JSON inválido.");
    }
}

domain::Reminder reminder_request_from(const httplib::Request& request,
                                       std::uint64_t id)
{
    nlohmann::json body = parse_request_body(request);

    if (!body.is_object())
    {
        throw std::invalid_argument("Reminder deve ser um objeto JSON.");
    }

    body["id"] = id;
    return json::reminder_from_json(body);
}

application::ListRemindersRequest list_request_from(
    const httplib::Request& request)
{
    const domain::Date start_date = json::date_from_json(
        required_query_parameter(request, "start_date"));
    const domain::Date end_date = json::date_from_json(
        required_query_parameter(request, "end_date"));

    std::optional<domain::ReminderType> type;
    if (request.has_param("type"))
    {
        type = json::reminder_type_from_json(
            request.get_param_value("type"));
    }

    std::optional<domain::ReminderRecurrence> recurrence;
    if (request.has_param("recurrence"))
    {
        recurrence = json::reminder_recurrence_from_json(
            request.get_param_value("recurrence"));
    }

    return application::ListRemindersRequest{
        start_date, end_date, type, recurrence};
}

nlohmann::json occurrence_to_json(
    const application::ReminderOccurrence& occurrence)
{
    return {
        {"reminder", json::to_json(occurrence.reminder)},
        {"occurrence_date", json::to_json(occurrence.occurrence_date)},
    };
}

void set_reminder_response(httplib::Response& response,
                           const domain::Reminder& reminder,
                           int status)
{
    response.status = status;
    response.set_content(json::to_json(reminder).dump(), "application/json");
}

persistence::ReminderRepository& require_repository(
    persistence::ReminderRepository* repository)
{
    if (repository == nullptr)
    {
        throw std::logic_error("ReminderRepository não está configurado.");
    }

    return *repository;
}

domain::Reminder find_created_or_updated(
    persistence::ReminderRepository& repository,
    std::uint64_t id,
    std::uint64_t user_id)
{
    const auto reminder = repository.find_by_id(id, user_id);

    if (!reminder.has_value())
    {
        throw std::logic_error(
            "ReminderRepository não devolveu o lembrete persistido.");
    }

    return *reminder;
}

// Dono da requisicao. O gate de autenticacao ja respondeu 401 a quem nao tem
// sessao valida; chegar aqui sem identidade seria defeito de programacao.
// Espelha goal_routes.cpp.
std::uint64_t caller_id(const ApiServer& api, const httplib::Request& request)
{
    const auto user_id = api.authenticated_user_id(request);

    if (!user_id.has_value())
    {
        throw std::logic_error(
            "Reminder route reached without an authenticated caller.");
    }

    return *user_id;
}

} // namespace

void register_reminder_routes(ApiServer& api)
{
    persistence::ReminderRepository* reminders = api.repositories().reminders;

    api.server().Get(
        "/api/reminders",
        [&api, reminders](const httplib::Request& request,
                          httplib::Response& response) {
            application::ListRemindersUseCase list_reminders{
                require_repository(reminders)};
            const auto occurrences = list_reminders.execute(
                list_request_from(request), caller_id(api, request));
            nlohmann::json body = nlohmann::json::array();

            for (const auto& occurrence : occurrences)
            {
                body.push_back(occurrence_to_json(occurrence));
            }

            response.set_content(body.dump(), "application/json");
        });

    api.server().Post(
        "/api/reminders",
        [&api, reminders](const httplib::Request& request,
                          httplib::Response& response) {
            auto& repository = require_repository(reminders);
            const std::uint64_t user_id = caller_id(api, request);
            const domain::Reminder parsed = reminder_request_from(request, 0);
            application::CreateReminderUseCase create_reminder{repository};
            const std::uint64_t id = create_reminder.execute(
                application::CreateReminderRequest{
                    parsed.description(), parsed.category(), parsed.date(),
                    parsed.time_slot(), parsed.type(), parsed.recurrence()},
                user_id);

            set_reminder_response(
                response, find_created_or_updated(repository, id, user_id), 201);
        });

    const char* const reminder_by_id =
        R"(/api/reminders(?:/([^/]*))?)";

    api.server().Get(
        reminder_by_id,
        [&api, reminders](const httplib::Request& request,
                          httplib::Response& response) {
            auto& repository = require_repository(reminders);
            const auto reminder = repository.find_by_id(
                path_id_from(request), caller_id(api, request));

            // Diferente de find_created_or_updated: aqui o id vem do usuario,
            // entao nao existir e 404, e nao defeito interno.
            if (!reminder.has_value())
            {
                throw shared::NotFoundError("Lembrete não encontrado.");
            }

            set_reminder_response(response, *reminder, 200);
        });

    api.server().Put(
        reminder_by_id,
        [&api, reminders](const httplib::Request& request,
                          httplib::Response& response) {
            auto& repository = require_repository(reminders);
            const std::uint64_t user_id = caller_id(api, request);
            const std::uint64_t id = path_id_from(request);
            const domain::Reminder parsed = reminder_request_from(request, id);
            application::UpdateReminderUseCase update_reminder{repository};

            update_reminder.execute(application::UpdateReminderRequest{
                id, parsed.description(), parsed.category(), parsed.date(),
                parsed.time_slot(), parsed.type(), parsed.recurrence()},
                user_id);

            set_reminder_response(
                response, find_created_or_updated(repository, id, user_id), 200);
        });

    api.server().Delete(
        reminder_by_id,
        [&api, reminders](const httplib::Request& request,
                          httplib::Response& response) {
            application::DeleteReminderUseCase delete_reminder{
                require_repository(reminders)};
            delete_reminder.execute(
                path_id_from(request), caller_id(api, request));
            response.status = 204;
        });
}

} // namespace virtual_planner::api::http
