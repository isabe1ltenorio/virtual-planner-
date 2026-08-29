#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/task_routes.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"

#include "support/expect.hpp"

#include <nlohmann/json.hpp>

#include <chrono>
#include <cstdint>
#include <string>
#include <string_view>
#include <thread>

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

    VP_EXPECT(port > 0, "task server should bind an ephemeral port");

    std::thread serving([&server] { server.serve(); });

    server.server().wait_until_ready();

    httplib::Client client{"127.0.0.1", port};
    client.set_read_timeout(5, 0);

    callable(client);

    server.stop();
    serving.join();
}

domain::Task task(domain::Date date,
                  domain::Category category,
                  domain::Priority priority,
                  domain::TaskStatus status,
                  domain::TimeSlot slot)
{
    return domain::Task{0, "seed task", category, date, slot, priority, status};
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;

    const domain::TimeSlot morning{std::chrono::hours{8}, std::chrono::hours{9}};
    const domain::TimeSlot mid_morning{
        std::chrono::hours{9}, std::chrono::hours{10}};
    const domain::TimeSlot late_morning{
        std::chrono::hours{10}, std::chrono::hours{11}};
    const domain::TimeSlot afternoon{
        std::chrono::hours{14}, std::chrono::hours{15}};

    // A: 05/08 Work/High/Executed
    tasks.save(task(domain::Date{5, 8, 2026}, domain::Category::Work,
                    domain::Priority::High, domain::TaskStatus::Executed,
                    morning));
    // B: 10/08 Study/High/Pending
    const std::uint64_t task_b = tasks.save(
        task(domain::Date{10, 8, 2026}, domain::Category::Study,
             domain::Priority::High, domain::TaskStatus::Pending, mid_morning));
    // C: 20/08 Work/High/Executed  -- alvo do filtro combinado
    const std::uint64_t task_c = tasks.save(
        task(domain::Date{20, 8, 2026}, domain::Category::Work,
             domain::Priority::High, domain::TaskStatus::Executed, late_morning));
    // D: 25/08 Work/Low/Pending  -- usada no DELETE
    const std::uint64_t task_d = tasks.save(
        task(domain::Date{25, 8, 2026}, domain::Category::Work,
             domain::Priority::Low, domain::TaskStatus::Pending, afternoon));

    persistence::RepositorySet repositories{&goals, &tasks, &reminders, &users};

    SilentLogger logger;

    const core::AppConfig config{"virtual-planner-task-test",
                                 core::ExecutionProfile::Test};

    http_api::ApiServer server{config, repositories, nullptr, logger};

    http_api::register_task_routes(server);

    with_running_server(server, [&](httplib::Client& client) {
        // --- GET /api/tasks/:id existente -> 200 ----------------------------
        {
            const auto response =
                client.Get("/api/tasks/" + std::to_string(task_b));

            VP_EXPECT(static_cast<bool>(response),
                      "GET /api/tasks/:id should answer");
            VP_EXPECT(response->status == 200,
                      "an existing task should answer 200");
            VP_EXPECT(response->get_header_value("Content-Type") ==
                          "application/json",
                      "an existing task should answer JSON");

            const auto body = nlohmann::json::parse(response->body);

            VP_EXPECT(body.at("id") == task_b,
                      "the response should carry the requested task id");
            VP_EXPECT(body.at("shift") == "Morning",
                      "the response should carry the derived shift");
        }

        // --- GET /api/tasks/:id inexistente -> 404 -------------------------
        {
            const auto missing = client.Get("/api/tasks/999999");

            VP_EXPECT(static_cast<bool>(missing), "GET for a missing task should answer");
            VP_EXPECT(missing->status == 404, "a missing task should answer 404");

            const auto error = nlohmann::json::parse(missing->body);
            VP_EXPECT(error.at("error").at("code") == "not_found",
                      "a missing task should use the not_found error code");
        }

        // --- GET /api/tasks sem filtro -> 200, todas ----------------------
        {
            const auto response = client.Get("/api/tasks");

            VP_EXPECT(static_cast<bool>(response), "GET /api/tasks should answer");
            VP_EXPECT(response->status == 200,
                      "an unfiltered list should answer 200");

            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.is_array(), "the list response should be an array");
            VP_EXPECT(body.size() == 4, "an empty filter should return every task");
        }

        // --- GET /api/tasks?category=Work -> subconjunto -----------------
        {
            const auto response = client.Get("/api/tasks?category=Work");

            VP_EXPECT(response->status == 200, "a category filter should answer 200");
            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.size() == 3, "category=Work should return three tasks");
        }

        // --- GET /api/tasks com filtros combinados via query string ------
        {
            const auto response = client.Get(
                "/api/tasks?start_date=2026-08-10&end_date=2026-08-31"
                "&category=Work&priority=High&status=Executed");

            VP_EXPECT(response->status == 200,
                      "combined filters should answer 200");

            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.size() == 1,
                      "combined filters should narrow to a single task");
            VP_EXPECT(body.front().at("id") == task_c,
                      "combined filters should return task C");
        }

        // --- GET /api/tasks com range invertido -> 400 -----------------
        {
            const auto response = client.Get(
                "/api/tasks?start_date=2026-08-20&end_date=2026-08-10");

            VP_EXPECT(response->status == 400,
                      "an inverted date range should answer 400");
        }

        // --- GET /api/tasks com valor de enum invalido -> 400 ----------
        {
            const auto bad_status = client.Get("/api/tasks?status=Banana");
            VP_EXPECT(bad_status->status == 400,
                      "an invalid status filter should answer 400");
            const auto body = nlohmann::json::parse(bad_status->body);
            VP_EXPECT(body.at("error").at("code") == "validation_error",
                      "an invalid filter should use validation_error");

            const auto bad_date =
                client.Get("/api/tasks?start_date=2026-02-30&end_date=2026-03-01");
            VP_EXPECT(bad_date->status == 400,
                      "an impossible date filter should answer 400");
        }

        // --- POST /api/tasks valido -> 201 ----------------------------
        std::uint64_t created_id = 0;
        {
            const nlohmann::json payload{
                {"description", "Escrever os testes de rota"},
                {"category", "Study"},
                {"date", "2026-08-15"},
                {"time_slot", {{"start", 480}, {"end", 540}}},
                {"priority", "High"},
            };

            const auto created = client.Post("/api/tasks", payload.dump(),
                                             "application/json");

            VP_EXPECT(static_cast<bool>(created), "POST /api/tasks should answer");
            VP_EXPECT(created->status == 201,
                      "a valid task should be created with 201");
            VP_EXPECT(created->get_header_value("Location").rfind("/api/tasks/",
                                                                 0) == 0,
                      "a created task should carry a Location header");

            const auto body = nlohmann::json::parse(created->body);
            VP_EXPECT(body.at("description") == "Escrever os testes de rota",
                      "the created task should preserve its description");
            VP_EXPECT(body.at("status") == "Pending",
                      "a new task should start Pending");
            VP_EXPECT(body.at("shift") == "Morning",
                      "the created task should carry the derived shift");

            created_id = body.at("id").get<std::uint64_t>();
        }

        // --- POST invalido: falta time_slot -> 400 ------------------
        {
            const nlohmann::json payload{
                {"description", "Sem horario"},
                {"category", "Study"},
                {"date", "2026-08-15"},
                {"priority", "High"},
            };

            const auto response = client.Post("/api/tasks", payload.dump(),
                                              "application/json");
            VP_EXPECT(response->status == 400,
                      "a missing required field should answer 400");
        }

        // --- POST com JSON malformado -> 400 ----------------------
        {
            const auto malformed =
                client.Post("/api/tasks", R"({"description":)",
                            "application/json");
            VP_EXPECT(malformed->status == 400,
                      "malformed JSON should answer 400");
        }

        // --- PATCH parcial -> 200 --------------------------------
        {
            const nlohmann::json payload{{"description", "Descricao nova"}};

            const auto updated =
                client.Patch("/api/tasks/" + std::to_string(created_id),
                             payload.dump(), "application/json");

            VP_EXPECT(updated->status == 200, "a valid PATCH should answer 200");

            const auto body = nlohmann::json::parse(updated->body);
            VP_EXPECT(body.at("description") == "Descricao nova",
                      "PATCH should update the requested field");
            VP_EXPECT(body.at("category") == "Study",
                      "PATCH should preserve an omitted field");
            VP_EXPECT(body.at("status") == "Pending",
                      "PATCH must not touch the status");
        }

        // --- PATCH id inexistente -> 404 -----------------------
        {
            const nlohmann::json payload{{"description", "x"}};
            const auto response = client.Patch("/api/tasks/999999",
                                               payload.dump(),
                                               "application/json");
            VP_EXPECT(response->status == 404,
                      "PATCH for a missing task should answer 404");
        }

        // --- PATCH payload invalido -> 400 --------------------
        {
            const nlohmann::json payload{{"description", 123}};
            const auto response =
                client.Patch("/api/tasks/" + std::to_string(created_id),
                             payload.dump(), "application/json");
            VP_EXPECT(response->status == 400,
                      "an invalid PATCH payload should answer 400");
        }

        // --- PATCH /status -> 200 ---------------------------
        {
            const nlohmann::json payload{{"status", "Executed"}};
            const auto response =
                client.Patch("/api/tasks/" + std::to_string(created_id) +
                                 "/status",
                             payload.dump(), "application/json");

            VP_EXPECT(response->status == 200,
                      "a valid status change should answer 200");
            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.at("status") == "Executed",
                      "the task status should be updated");
        }

        // --- PATCH /status id inexistente -> 404 ------------
        {
            const nlohmann::json payload{{"status", "Executed"}};
            const auto response = client.Patch("/api/tasks/999999/status",
                                               payload.dump(),
                                               "application/json");
            VP_EXPECT(response->status == 404,
                      "status PATCH for a missing task should answer 404");
        }

        // --- PATCH /status valor invalido -> 400 ----------
        {
            const nlohmann::json payload{{"status", "Banana"}};
            const auto response =
                client.Patch("/api/tasks/" + std::to_string(created_id) +
                                 "/status",
                             payload.dump(), "application/json");
            VP_EXPECT(response->status == 400,
                      "an invalid status should answer 400");
            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.at("error").at("code") == "validation_error",
                      "an invalid status should use validation_error");
        }

        // --- PATCH /status sem o campo status -> 400 ------
        {
            const auto response =
                client.Patch("/api/tasks/" + std::to_string(created_id) +
                                 "/status",
                             nlohmann::json::object().dump(),
                             "application/json");
            VP_EXPECT(response->status == 400,
                      "a missing status field should answer 400");
        }

        // --- DELETE existente -> 204, depois GET -> 404 --
        {
            const auto deleted =
                client.Delete("/api/tasks/" + std::to_string(task_d));
            VP_EXPECT(deleted->status == 204,
                      "deleting an existing task should answer 204");

            const auto after = client.Get("/api/tasks/" + std::to_string(task_d));
            VP_EXPECT(after->status == 404,
                      "a deleted task should no longer exist");
        }

        // --- DELETE inexistente -> 404 ------------------
        {
            const auto response = client.Delete("/api/tasks/999999");
            VP_EXPECT(response->status == 404,
                      "deleting a missing task should answer 404");
            const auto body = nlohmann::json::parse(response->body);
            VP_EXPECT(body.at("error").at("code") == "not_found",
                      "deleting a missing task should use not_found");
        }
    });

    return 0;
}
