#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/routes/reminder_routes.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"

#include "support/authenticated_client.hpp"
#include "support/expect.hpp"

#include <nlohmann/json.hpp>

#include <cstdint>
#include <string>
#include <string_view>
#include <thread>
#include <utility>

using namespace virtual_planner;
namespace http_api = virtual_planner::api::http;

namespace {

class SilentLogger final : public interfaces::Logger
{
public:
    void log(interfaces::LogLevel,
             std::string_view,
             std::string_view) override
    {
    }
};

template <typename Callable>
void with_running_server(http_api::ApiServer& server, Callable callable)
{
    http_api::ServerConfig config;
    config.host = "127.0.0.1";
    config.port = 0;

    const int port = server.bind(config);
    VP_EXPECT(port > 0, "o servidor de Reminder deve abrir uma porta efêmera");

    std::thread serving([&server] { server.serve(); });
    server.server().wait_until_ready();

    httplib::Client client{"127.0.0.1", port};
    client.set_read_timeout(5, 0);

    callable(client);

    server.stop();
    serving.join();
}

nlohmann::json reminder_body(std::string description,
                             std::string category,
                             std::string date,
                             int start,
                             int end,
                             std::string type,
                             std::string recurrence)
{
    return {
        {"description", std::move(description)},
        {"category", std::move(category)},
        {"date", std::move(date)},
        {"time_slot", {{"start", start}, {"end", end}}},
        {"type", std::move(type)},
        {"recurrence", std::move(recurrence)},
    };
}

void expect_error(const httplib::Result& response,
                  int status,
                  const char* code,
                  const char* message)
{
    VP_EXPECT(static_cast<bool>(response), message);
    VP_EXPECT(response->status == status, message);
    VP_EXPECT(response->get_header_value("Content-Type") == "application/json",
              "a resposta de erro deve usar JSON");

    const auto body = nlohmann::json::parse(response->body);
    VP_EXPECT(body.contains("error"), "a resposta deve conter o objeto error");
    VP_EXPECT(body.at("error").contains("code"),
              "o erro deve conter um código estável");
    VP_EXPECT(body.at("error").contains("message"),
              "o erro deve conter uma mensagem");
    VP_EXPECT(body.at("error").at("code") == code, message);
}

nlohmann::json post_reminder(httplib::Client& client,
                             const nlohmann::json& request_body)
{
    const auto response = client.Post(
        "/api/reminders", request_body.dump(), "application/json");

    VP_EXPECT(static_cast<bool>(response), "a criação deve responder");
    VP_EXPECT(response->status == 201, "a criação válida deve responder 201");
    VP_EXPECT(response->get_header_value("Content-Type") == "application/json",
              "a criação deve responder JSON");

    return nlohmann::json::parse(response->body);
}

nlohmann::json get_reminders(httplib::Client& client,
                             const std::string& query)
{
    const auto response = client.Get("/api/reminders?" + query);

    VP_EXPECT(static_cast<bool>(response), "a listagem deve responder");
    VP_EXPECT(response->status == 200, "a listagem válida deve responder 200");
    VP_EXPECT(response->get_header_value("Content-Type") == "application/json",
              "a listagem deve responder JSON");

    return nlohmann::json::parse(response->body);
}

bool contains_reminder_id(const nlohmann::json& occurrences,
                          std::uint64_t id)
{
    for (const auto& occurrence : occurrences)
    {
        if (occurrence.at("reminder").at("id") == id)
        {
            return true;
        }
    }

    return false;
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;
    persistence::RepositorySet repositories{
        &goals, &tasks, &reminders, &users};
    SilentLogger logger;
    const core::AppConfig config{
        "virtual-planner-reminder-test", core::ExecutionProfile::Test};
    http_api::ApiServer server{config, repositories, nullptr, logger};
    http_api::register_auth_routes(server);
    http_api::register_reminder_routes(server);

    with_running_server(server, [&reminders](httplib::Client& client) {
        // O gate de sessao recusa 401 toda rota de dominio. Autenticar e o
        // primeiro passo de qualquer teste de API desde a introducao do login.
        const auto alice =
            testing::register_and_login(client, "alice@example.com", "Alice");
        testing::authenticate_as(client, alice);

        const auto empty = get_reminders(
            client, "start_date=2026-08-01&end_date=2026-08-31");
        VP_EXPECT(empty.is_array() && empty.empty(),
                  "um repositório vazio deve responder com array vazio");

        expect_error(client.Get("/api/reminders?end_date=2026-08-31"),
                     400, "validation_error",
                     "start_date ausente deve responder 400");
        expect_error(client.Get("/api/reminders?start_date=2026-08-01"),
                     400, "validation_error",
                     "end_date ausente deve responder 400");
        expect_error(client.Get(
                         "/api/reminders?start_date=2026-02-30&end_date=2026-08-31"),
                     400, "validation_error",
                     "uma data inválida deve responder 400");
        expect_error(client.Get(
                         "/api/reminders?start_date=2026-08-31&end_date=2026-08-01"),
                     400, "validation_error",
                     "uma janela invertida deve responder 400");
        expect_error(client.Get(
                         "/api/reminders?start_date=2026-08-01&end_date=2026-08-31&type=Unknown"),
                     400, "validation_error",
                     "um tipo inválido deve responder 400");
        expect_error(client.Get(
                         "/api/reminders?start_date=2026-08-01&end_date=2026-08-31&recurrence=Yearly"),
                     400, "validation_error",
                     "uma recorrência inválida deve responder 400");

        auto once_request = reminder_body(
            "Prova", "Study", "2026-08-10", 540, 600, "Study", "Once");
        once_request["id"] = 999;
        const auto once = post_reminder(client, once_request);
        const std::uint64_t once_id = once.at("id").get<std::uint64_t>();

        VP_EXPECT(once_id != 0 && once_id != 999,
                  "o repositório deve gerar o ID da criação");
        VP_EXPECT(once.at("description") == "Prova",
                  "a resposta deve usar o formato de Reminder");
        VP_EXPECT(once.at("category") == "Study",
                  "a resposta deve serializar a categoria");
        VP_EXPECT(once.at("date") == "2026-08-10",
                  "a resposta deve serializar a data ISO");
        VP_EXPECT(once.at("time_slot").at("start") == 540,
                  "a resposta deve serializar o horário");
        VP_EXPECT(once.at("type") == "Study",
                  "a resposta deve serializar o tipo");
        VP_EXPECT(once.at("recurrence") == "Once",
                  "a resposta deve serializar a recorrência");

        const auto weekly = post_reminder(
            client,
            reminder_body("Reunião", "Work", "2026-08-03", 600, 660,
                          "Meeting", "Weekly"));
        const std::uint64_t weekly_id = weekly.at("id").get<std::uint64_t>();

        const auto once_inside = get_reminders(
            client, "start_date=2026-08-10&end_date=2026-08-10");
        VP_EXPECT(contains_reminder_id(once_inside, once_id),
                  "Once deve aparecer dentro da janela");

        const auto once_outside = get_reminders(
            client,
            "start_date=2026-08-11&end_date=2026-08-12&recurrence=Once");
        VP_EXPECT(!contains_reminder_id(once_outside, once_id),
                  "Once não deve aparecer fora da janela");

        const auto by_type = get_reminders(
            client,
            "start_date=2026-08-10&end_date=2026-08-24&type=Meeting");
        VP_EXPECT(by_type.size() == 3,
                  "o filtro type deve manter as ocorrências correspondentes");

        const auto by_recurrence = get_reminders(
            client,
            "start_date=2026-08-10&end_date=2026-08-24&recurrence=Once");
        VP_EXPECT(by_recurrence.size() == 1,
                  "o filtro recurrence deve manter apenas Once");

        const auto combined = get_reminders(
            client,
            "start_date=2026-08-10&end_date=2026-08-24&type=Meeting&recurrence=Weekly");
        VP_EXPECT(combined.size() == 3,
                  "os filtros combinados devem usar semântica AND");
        VP_EXPECT(combined[0].at("occurrence_date") == "2026-08-10",
                  "start_date deve ser inclusivo");
        VP_EXPECT(combined[1].at("occurrence_date") == "2026-08-17",
                  "uma recorrência semanal deve produzir múltiplas ocorrências");
        VP_EXPECT(combined[2].at("occurrence_date") == "2026-08-24",
                  "end_date deve ser inclusivo");
        VP_EXPECT(combined[1].at("occurrence_date") !=
                      combined[1].at("reminder").at("date"),
                  "a ocorrência repetida deve diferir da data-base");
        VP_EXPECT(combined[1].at("reminder").at("date") == "2026-08-03",
                  "Reminder.date deve permanecer como data-base");
        VP_EXPECT(combined[1].at("reminder").at("id") == weekly_id,
                  "as ocorrências devem preservar o Reminder original");

        expect_error(client.Post(
                         "/api/reminders", "{", "application/json"),
                     400, "validation_error",
                     "JSON sintaticamente inválido deve responder 400");
        expect_error(client.Post(
                         "/api/reminders", "[]", "application/json"),
                     400, "validation_error",
                     "um body que não seja objeto deve responder 400");

        auto missing = reminder_body(
            "Inválido", "Study", "2026-08-20", 540, 600, "Study", "Once");
        missing.erase("category");
        expect_error(client.Post(
                         "/api/reminders", missing.dump(), "application/json"),
                     400, "validation_error",
                     "um campo obrigatório ausente deve responder 400");

        auto wrong_type = reminder_body(
            "Inválido", "Study", "2026-08-20", 540, 600, "Study", "Once");
        wrong_type["description"] = 42;
        expect_error(client.Post(
                         "/api/reminders", wrong_type.dump(), "application/json"),
                     400, "validation_error",
                     "um tipo JSON incorreto deve responder 400");

        auto blank = reminder_body(
            "   ", "Study", "2026-08-20", 540, 600, "Study", "Once");
        expect_error(client.Post(
                         "/api/reminders", blank.dump(), "application/json"),
                     400, "validation_error",
                     "uma descrição inválida deve responder 400");

        auto invalid_enum = reminder_body(
            "Inválido", "Study", "2026-08-20", 540, 600, "Unknown", "Once");
        expect_error(client.Post(
                         "/api/reminders", invalid_enum.dump(), "application/json"),
                     400, "validation_error",
                     "um enum inválido deve responder 400");

        auto invalid_date = reminder_body(
            "Inválido", "Study", "2026-02-30", 540, 600, "Study", "Once");
        expect_error(client.Post(
                         "/api/reminders", invalid_date.dump(), "application/json"),
                     400, "validation_error",
                     "uma data inválida deve responder 400");

        auto invalid_slot = reminder_body(
            "Inválido", "Study", "2026-08-20", 600, 540, "Study", "Once");
        expect_error(client.Post(
                         "/api/reminders", invalid_slot.dump(), "application/json"),
                     400, "validation_error",
                     "um time_slot inválido deve responder 400");

        auto update = reminder_body(
            "Prova atualizada", "Work", "2026-08-12", 720, 840,
            "Assignment", "Daily");
        update["id"] = weekly_id;
        const auto updated_response = client.Put(
            "/api/reminders/" + std::to_string(once_id),
            update.dump(), "application/json");
        VP_EXPECT(static_cast<bool>(updated_response),
                  "a atualização deve responder");
        VP_EXPECT(updated_response->status == 200,
                  "uma atualização válida deve responder 200");
        VP_EXPECT(updated_response->get_header_value("Content-Type") ==
                      "application/json",
                  "a atualização deve responder JSON");
        const auto updated = nlohmann::json::parse(updated_response->body);
        VP_EXPECT(updated.at("id") == once_id,
                  "o ID do path deve prevalecer sobre o ID do body");
        VP_EXPECT(updated.at("description") == "Prova atualizada" &&
                      updated.at("category") == "Work" &&
                      updated.at("date") == "2026-08-12" &&
                      updated.at("time_slot").at("start") == 720 &&
                      updated.at("time_slot").at("end") == 840 &&
                      updated.at("type") == "Assignment" &&
                      updated.at("recurrence") == "Daily",
                  "PUT deve substituir todos os campos editáveis");
        VP_EXPECT(reminders.find_all().size() == 2,
                  "PUT não deve criar um segundo Reminder");

        auto invalid_update = update;
        invalid_update["description"] = " ";
        expect_error(client.Put(
                         "/api/reminders/" + std::to_string(once_id),
                         invalid_update.dump(), "application/json"),
                     400, "validation_error",
                     "um PUT inválido deve responder 400");
        expect_error(client.Put(
                         "/api/reminders/99999", update.dump(), "application/json"),
                     404, "not_found",
                     "um PUT inexistente deve responder 404");
        expect_error(client.Put(
                         "/api/reminders/12abc", update.dump(), "application/json"),
                     400, "validation_error",
                     "um ID parcialmente numérico deve responder 400");
        expect_error(client.Put(
                         "/api/reminders/", update.dump(), "application/json"),
                     400, "validation_error",
                     "um ID vazio deve responder 400");
        expect_error(client.Put(
                         "/api/reminders/texto", update.dump(), "application/json"),
                     400, "validation_error",
                     "um ID textual deve responder 400");
        expect_error(client.Put(
                         "/api/reminders/1.5", update.dump(), "application/json"),
                     400, "validation_error",
                     "um ID decimal deve responder 400");
        expect_error(client.Put(
                         "/api/reminders/18446744073709551616",
                         update.dump(), "application/json"),
                     400, "validation_error",
                     "um ID acima de uint64 deve responder 400");
        expect_error(client.Delete("/api/reminders/-1"),
                     400, "validation_error",
                     "um ID negativo deve responder 400");

        const auto deleted = client.Delete(
            "/api/reminders/" + std::to_string(once_id));
        VP_EXPECT(static_cast<bool>(deleted), "a exclusão deve responder");
        VP_EXPECT(deleted->status == 204,
                  "uma exclusão válida deve responder 204");
        VP_EXPECT(deleted->body.empty(), "a resposta 204 deve ter corpo vazio");

        const auto after_delete = get_reminders(
            client, "start_date=2026-08-01&end_date=2026-08-31");
        VP_EXPECT(!contains_reminder_id(after_delete, once_id),
                  "o Reminder excluído não deve aparecer na listagem");
        expect_error(client.Delete(
                         "/api/reminders/" + std::to_string(once_id)),
                     404, "not_found",
                     "excluir novamente deve responder 404");

        // --- GET /api/reminders/:id ------------------------------------
        //
        // Leitura de um lembrete so. A listagem expande ocorrencias de um
        // recorrente; este devolve a regra em si, que e o que a tela de
        // edicao precisa carregar.
        const auto single = client.Get(
            "/api/reminders/" + std::to_string(weekly_id));
        VP_EXPECT(static_cast<bool>(single), "a busca por ID deve responder");
        VP_EXPECT(single->status == 200,
                  "buscar um Reminder existente deve responder 200");
        VP_EXPECT(single->get_header_value("Content-Type") ==
                      "application/json",
                  "a busca por ID deve responder JSON");

        const auto single_body = nlohmann::json::parse(single->body);
        VP_EXPECT(single_body.at("id") == weekly_id,
                  "a busca por ID deve devolver o Reminder pedido");
        VP_EXPECT(single_body.contains("recurrence"),
                  "a busca por ID devolve a regra, com a recorrência");

        expect_error(client.Get("/api/reminders/999999"),
                     404, "not_found",
                     "buscar um Reminder inexistente deve responder 404");
        expect_error(client.Get("/api/reminders/abc"),
                     400, "validation_error",
                     "um ID não numérico deve responder 400");
    });

    return 0;
}
