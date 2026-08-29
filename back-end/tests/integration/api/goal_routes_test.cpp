#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/routes/goal_routes.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/domain/entities/goal.hpp"
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

    VP_EXPECT(
        port > 0,
        "goal server should bind an ephemeral port");

    std::thread serving([&server] {
        server.serve();
    });

    server.server().wait_until_ready();

    httplib::Client client{"127.0.0.1", port};
    client.set_read_timeout(5, 0);

    callable(client);

    server.stop();
    serving.join();
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;

    persistence::RepositorySet repositories{
        &goals,
        &tasks,
        &reminders,
        &users};

    SilentLogger logger;

    const core::AppConfig config{
        "virtual-planner-goal-test",
        core::ExecutionProfile::Test};

    http_api::ApiServer server{
        config,
        repositories,
        nullptr,
        logger};

    http_api::register_auth_routes(server);
    http_api::register_goal_routes(server);

    with_running_server(
        server,
        [&goals](httplib::Client& client) {
            // O gate de sessao recusa qualquer rota de Goal sem cookie: o
            // primeiro passo de todo teste passa a ser existir como usuario.
            const auto alice =
                testing::register_and_login(client, "alice@example.com", "Alice");
            testing::authenticate_as(client, alice);

            const auto make_goal = [](std::string description,
                                      domain::Category category,
                                      domain::GoalPeriod period,
                                      domain::Date reference_date) {
                return domain::Goal{
                    0,
                    std::move(description),
                    category,
                    domain::GoalStatus::InProgress,
                    period,
                    reference_date};
            };

            const std::uint64_t goal_id = goals.save(
                make_goal("Study C++", domain::Category::Study,
                          domain::GoalPeriod::Weekly, domain::Date{5, 8, 2026}),
                alice.id);

            goals.save(
                make_goal("Finish Planner", domain::Category::Work,
                          domain::GoalPeriod::Monthly, domain::Date{20, 8, 2026}),
                alice.id);

            const std::uint64_t deletable_goal_id = goals.save(
                make_goal("Goal to delete", domain::Category::Study,
                          domain::GoalPeriod::Weekly, domain::Date{25, 8, 2026}),
                alice.id);

            // GET existente -> 200
            const auto response =
                client.Get("/api/goals/" + std::to_string(goal_id));

            VP_EXPECT(
                static_cast<bool>(response),
                "GET /api/goals/:id should answer");

            VP_EXPECT(
                response->status == 200,
                "an existing goal should answer 200");

            VP_EXPECT(
                response->get_header_value("Content-Type") ==
                    "application/json",
                "an existing goal should answer JSON");

            const auto body =
                nlohmann::json::parse(response->body);

            VP_EXPECT(
                body.at("id") == goal_id,
                "the response should contain the requested goal id");

            VP_EXPECT(
                body.at("description") == "Study C++",
                "the response should contain the requested goal");

            // GET lista com filtro semanal -> 200
            const auto list_response =
                client.Get(
                    "/api/goals?period=weekly&date=2026-08-05");

            VP_EXPECT(
                static_cast<bool>(list_response),
                "GET /api/goals should answer");

            VP_EXPECT(
                list_response->status == 200,
                "a valid goal list request should answer 200");

            const auto list_body =
                nlohmann::json::parse(list_response->body);
            VP_EXPECT(
                list_body.is_array(),
                "the goal list response should be an array");
            VP_EXPECT(
                list_body.size() == 1,
                "the weekly filter should return only goals inside the week");
            VP_EXPECT(
                list_body.front().at("description") == "Study C++",
                "the weekly filter should return the goal inside the requested week");
            const auto missing_period =
                client.Get(
                    "/api/goals?date=2026-08-05");
            VP_EXPECT(
                static_cast<bool>(missing_period),
                "a request without period should answer");
            VP_EXPECT(
                missing_period->status == 400,
                "a missing period should answer 400");
            const auto missing_period_body =
                nlohmann::json::parse(missing_period->body);
            VP_EXPECT(
                missing_period_body.at("error").at("code") ==
                    "validation_error",
                "a missing period should use validation_error");
            const auto invalid_period =
                client.Get(
                    "/api/goals?period=daily&date=2026-08-05");
            VP_EXPECT(
                static_cast<bool>(invalid_period),
                "an invalid period should answer");
            VP_EXPECT(
                invalid_period->status == 400,
                "an invalid period should answer 400");
            const auto invalid_date =
                client.Get(
                    "/api/goals?period=weekly&date=2026-02-30");
            VP_EXPECT(
                static_cast<bool>(invalid_date),
                "an invalid date should answer");
            VP_EXPECT(
                invalid_date->status == 400,
                "an invalid date should answer 400");
// GET inexistente -> 404
            const auto missing =
                client.Get("/api/goals/999999");
            VP_EXPECT(
                static_cast<bool>(missing),
                "GET for a missing goal should answer");
            VP_EXPECT(
                missing->status == 404,
                "a missing goal should answer 404");
            const auto error =
                nlohmann::json::parse(missing->body);
            VP_EXPECT(
                error.at("error").at("code") == "not_found",
                "a missing goal should use the not_found error code");
            // POST válido -> 201
            const nlohmann::json create_payload{
                {"description", "Read C++ book"},
                {"category", "Study"},
                {"period", "Weekly"},
                {"reference_date", "2026-08-15"},
            };
            const auto created =
                client.Post(
                    "/api/goals",
                    create_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(created),
                "POST /api/goals should answer");
            VP_EXPECT(
                created->status == 201,
                "a valid goal should be created with 201");
            const auto created_body =
                nlohmann::json::parse(created->body);
            VP_EXPECT(
                created_body.at("description") == "Read C++ book",
                "the created goal should preserve its description");
            VP_EXPECT(
                created_body.at("status") == "In Progress",
                "a new goal should start in progress");
            // POST inválido
            const nlohmann::json missing_description{
                {"category", "Study"},
                {"period", "Weekly"},
                {"reference_date", "2026-08-15"},
            };
            const auto invalid_payload =
                client.Post(
                    "/api/goals",
                    missing_description.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(invalid_payload),
                "an invalid POST should answer");
            VP_EXPECT(
                invalid_payload->status == 400,
                "a missing required field should answer 400");
            // PATCH parcial -> 200
            const nlohmann::json update_payload{
                {"description", "Study modern C++"},
            };
            const auto updated =
                client.Patch(
                    "/api/goals/" +
                        std::to_string(goal_id),
                    update_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(updated),
                "PATCH /api/goals/:id should answer");
            VP_EXPECT(
                updated->status == 200,
                "a valid PATCH should answer 200");
            const auto updated_body =
                nlohmann::json::parse(
                    updated->body);
            VP_EXPECT(
                updated_body.at("description") ==
                    "Study modern C++",
                "PATCH should update the requested field");
            VP_EXPECT(
                updated_body.at("category") ==
                    "Study",
                "PATCH should preserve an omitted category");
            VP_EXPECT(
                updated_body.at("period") ==
                    "Weekly",
                "PATCH should preserve an omitted period");
            VP_EXPECT(
                updated_body.at("reference_date") ==
                    "2026-08-05",
                "PATCH should preserve an omitted reference date");
            const nlohmann::json missing_update_payload{
                {"description", "Missing goal"},
            };
            const auto missing_update =
                client.Patch(
                    "/api/goals/999999",
                    missing_update_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(missing_update),
                "PATCH for a missing goal should answer");
            VP_EXPECT(
                missing_update->status == 404,
                "PATCH for a missing goal should answer 404");
            const nlohmann::json invalid_update_payload{
                {"description", 123},
            };
            const auto invalid_update =
                client.Patch(
                    "/api/goals/" +
                        std::to_string(goal_id),
                    invalid_update_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(invalid_update),
                "an invalid PATCH should answer");
            VP_EXPECT(
                invalid_update->status == 400,
                "an invalid PATCH payload should answer 400");
// PATCH status -> 200
            const nlohmann::json status_payload{
                {"status", "Completed"},
            };
            const auto status_updated =
                client.Patch(
                    "/api/goals/" +
                        std::to_string(goal_id) +
                        "/status",
                    status_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(status_updated),
                "PATCH /api/goals/:id/status should answer");
            VP_EXPECT(
                status_updated->status == 200,
                "a valid status change should answer 200");
            const auto status_body =
                nlohmann::json::parse(
                    status_updated->body);
            VP_EXPECT(
                status_body.at("status") == "Completed",
                "the goal status should be updated");
            const nlohmann::json missing_status_payload{
            {"status", "Completed"},
            };
            const auto missing_status =
                client.Patch(
                    "/api/goals/999999/status",
                    missing_status_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(missing_status),
                "status PATCH for a missing goal should answer");
            VP_EXPECT(
                missing_status->status == 404,
                "status PATCH for a missing goal should answer 404");
            const nlohmann::json invalid_status_payload{
                {"status", "Banana"},
            };
            const auto invalid_status =
                client.Patch(
                    "/api/goals/" +
                        std::to_string(goal_id) +
                        "/status",
                    invalid_status_payload.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(invalid_status),
                "an invalid status PATCH should answer");
            VP_EXPECT(
                invalid_status->status == 400,
                "an invalid goal status should answer 400");

            const auto invalid_status_body =
                nlohmann::json::parse(
                    invalid_status->body);
            VP_EXPECT(
                invalid_status_body.at("error").at("code") ==
                    "validation_error",
                "an invalid goal status should use validation_error");
            const nlohmann::json missing_status_field =
                nlohmann::json::object();
            const auto no_status =
                client.Patch(
                    "/api/goals/" +
                        std::to_string(goal_id) +
                        "/status",
                    missing_status_field.dump(),
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(no_status),
                "a status PATCH without status should answer");
            VP_EXPECT(
                no_status->status == 400,
                "a missing status field should answer 400");
            // JSON malformado
            const auto malformed =
                client.Post(
                    "/api/goals",
                    R"({"description":)",
                    "application/json");
            VP_EXPECT(
                static_cast<bool>(malformed),
                "a malformed JSON request should answer");
            VP_EXPECT(
                malformed->status == 400,
                "malformed JSON should answer 400");
            // DELETE existente -> 204
            const auto deleted =
                client.Delete(
                    "/api/goals/" +
                    std::to_string(deletable_goal_id));
            VP_EXPECT(
                static_cast<bool>(deleted),
                "DELETE /api/goals/:id should answer");

            VP_EXPECT(
                deleted->status == 204,
                "deleting an existing goal should answer 204");
            const auto after_delete =
                client.Get(
                    "/api/goals/" +
                    std::to_string(deletable_goal_id));
            VP_EXPECT(
                static_cast<bool>(after_delete),
                "GET after DELETE should answer");
            VP_EXPECT(
                after_delete->status == 404,
                "a deleted goal should no longer exist");
            // DELETE inexistente -> 404
            const auto missing_delete =
                client.Delete(
                    "/api/goals/999999");
            VP_EXPECT(
                static_cast<bool>(missing_delete),
                "DELETE for a missing goal should answer");
            VP_EXPECT(
                missing_delete->status == 404,
                "deleting a missing goal should answer 404");
            const auto missing_delete_body =
                nlohmann::json::parse(
                    missing_delete->body);
            VP_EXPECT(
                missing_delete_body.at("error").at("code") ==
                    "not_found",
                "deleting a missing goal should use not_found");

            // --- Isolamento entre usuarios (issue #112) --------------------
            //
            // Bob se autentica no mesmo servidor e tenta alcancar a meta da
            // Alice pelo id, que ele conhece. Toda resposta tem de ser
            // indistinguivel de "nao existe": um 403 confirmaria a ele que
            // aquele id esta em uso.
            const auto bob =
                testing::register_and_login(client, "bob@example.com", "Bob");
            testing::authenticate_as(client, bob);

            const std::string alice_path =
                "/api/goals/" + std::to_string(goal_id);

            const auto bob_reads = client.Get(alice_path);
            VP_EXPECT(static_cast<bool>(bob_reads),
                      "reading another user's goal should answer");
            VP_EXPECT(bob_reads->status == 404,
                      "reading another user's goal should answer 404");

            const nlohmann::json hijack{{"description", "Hijacked"}};

            const auto bob_updates =
                client.Patch(alice_path, hijack.dump(), "application/json");
            VP_EXPECT(static_cast<bool>(bob_updates),
                      "updating another user's goal should answer");
            VP_EXPECT(bob_updates->status == 404,
                      "updating another user's goal should answer 404");

            const nlohmann::json hijack_status{{"status", "Failed"}};

            const auto bob_changes_status = client.Patch(
                alice_path + "/status", hijack_status.dump(), "application/json");
            VP_EXPECT(static_cast<bool>(bob_changes_status),
                      "changing another user's goal status should answer");
            VP_EXPECT(bob_changes_status->status == 404,
                      "changing another user's goal status should answer 404");

            const auto bob_deletes = client.Delete(alice_path);
            VP_EXPECT(static_cast<bool>(bob_deletes),
                      "deleting another user's goal should answer");
            VP_EXPECT(bob_deletes->status == 404,
                      "deleting another user's goal should answer 404");

            // A listagem de Bob e vazia, mesmo com metas da Alice na base.
            const auto bob_list =
                client.Get("/api/goals?period=monthly&date=2026-08-05");
            VP_EXPECT(static_cast<bool>(bob_list),
                      "listing goals should answer for another user");
            VP_EXPECT(bob_list->status == 200,
                      "listing goals should answer 200 for another user");
            VP_EXPECT(nlohmann::json::parse(bob_list->body).empty(),
                      "another user's goals must not appear in the listing");

            // E a meta da Alice continua intacta depois de todas as tentativas.
            testing::authenticate_as(client, alice);

            const auto still_there = client.Get(alice_path);
            VP_EXPECT(static_cast<bool>(still_there) &&
                          still_there->status == 200,
                      "the owner should still reach the goal");
            VP_EXPECT(nlohmann::json::parse(still_there->body)
                              .at("description") == "Study modern C++",
                      "refused writes must not have changed the goal");
        });

    return 0;
}
