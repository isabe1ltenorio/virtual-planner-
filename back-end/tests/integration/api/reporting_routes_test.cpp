// P-34: teste de integracao HTTP dos endpoints de relatorios e dashboard.
#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/routes/reporting_routes.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/domain/entities/goal.hpp"
#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"

#include "support/authenticated_client.hpp"
#include "support/expect.hpp"

#include <nlohmann/json.hpp>

#include <array>
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
    VP_EXPECT(port > 0, "reporting server should bind an ephemeral port");

    std::thread serving([&server] { server.serve(); });
    server.server().wait_until_ready();

    httplib::Client client{"127.0.0.1", port};
    client.set_read_timeout(5, 0);

    callable(client);

    server.stop();
    serving.join();
}

nlohmann::json get_json(httplib::Client& client, const std::string& path)
{
    const auto response = client.Get(path);

    VP_EXPECT(static_cast<bool>(response), "the reporting endpoint should answer");
    VP_EXPECT(response->status == 200, "the reporting endpoint should answer 200");
    VP_EXPECT(response->get_header_value("Content-Type") == "application/json",
              "the reporting endpoint should answer JSON");

    return nlohmann::json::parse(response->body);
}

void expect_complete_summary(const nlohmann::json& body)
{
    constexpr std::array<std::string_view, 16> fields{
        "start_date",
        "end_date",
        "goals_total",
        "goals_completed",
        "goals_partially_completed",
        "goals_ratio",
        "tasks_total",
        "tasks_executed",
        "tasks_partially_executed",
        "tasks_ratio",
        "most_productive_weeks",
        "most_productive_months",
        "most_productive_shifts",
        "task_categories",
        "goal_categories",
        "productivity_index",
    };

    for (const std::string_view field : fields)
    {
        VP_EXPECT(body.contains(std::string{field}),
                  "the API should expose every P-63 summary field");
    }
}

void expect_complete_bucket(const nlohmann::json& bucket)
{
    VP_EXPECT(bucket.contains("label"), "a bucket should expose its label");
    VP_EXPECT(bucket.contains("total"), "a bucket should expose its total");
    VP_EXPECT(bucket.contains("score"), "a bucket should expose its score");
    VP_EXPECT(bucket.contains("ratio"), "a bucket should expose its ratio");
}

void expect_validation_error(httplib::Client& client, const std::string& path)
{
    const auto response = client.Get(path);

    VP_EXPECT(static_cast<bool>(response), "an invalid report request should answer");
    VP_EXPECT(response->status == 400, "an invalid report request should answer 400");

    const auto body = nlohmann::json::parse(response->body);
    VP_EXPECT(body.at("error").at("code") == "validation_error",
              "invalid report parameters should use validation_error");
}

domain::Task make_task(std::uint64_t id,
                       const domain::Date& date,
                       domain::TaskStatus status)
{
    return domain::Task{
        id,
        "tarefa de relatorio",
        domain::Category::Work,
        date,
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium,
        status};
}

} // namespace

int main()
{
    // Arrange
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;

    persistence::RepositorySet repositories{
        &goals, &tasks, &reminders, &users};
    SilentLogger logger;
    const core::AppConfig config{
        "virtual-planner-reporting-test", core::ExecutionProfile::Test};
    http_api::ApiServer server{config, repositories, nullptr, logger};
    http_api::register_auth_routes(server);
    http_api::register_reporting_routes(server);

    // Act
    with_running_server(server, [&goals, &tasks](httplib::Client& client) {
        // Sem sessao os dois endpoints respondem 401: o relatorio e sempre de
        // alguem, nunca da base inteira (issue #113).
        const auto alice =
            testing::register_and_login(client, "alice@example.com", "Alice");
        testing::authenticate_as(client, alice);

        goals.save(domain::Goal{
            0,
            "meta de relatorio",
            domain::Category::Study,
            domain::GoalStatus::Completed,
            domain::GoalPeriod::Weekly,
            domain::Date{3, 8, 2026}}, alice.id);

        tasks.save(make_task(
            1, domain::Date{9, 8, 2026}, domain::TaskStatus::Executed), alice.id);
        tasks.save(make_task(
            2, domain::Date{10, 8, 2026}, domain::TaskStatus::Cancelled), alice.id);

        const auto weekly = get_json(
            client, "/api/reports?period=weekly&date=2026-08-05");

        // Assert: a semana ISO inclui segunda e domingo, mas não a segunda
        // seguinte, e o payload espelha integralmente o ReportingService.
        expect_complete_summary(weekly);
        VP_EXPECT(weekly.at("start_date") == "2026-08-03",
                  "the ISO week should start on Monday");
        VP_EXPECT(weekly.at("end_date") == "2026-08-09",
                  "the ISO week should end on Sunday");
        VP_EXPECT(weekly.at("goals_total") == 1,
                  "the weekly report should include the goal on Monday");
        VP_EXPECT(weekly.at("tasks_total") == 1,
                  "the weekly report should include Sunday but exclude next Monday");
        VP_EXPECT(weekly.at("goals_ratio") == 1.0,
                  "the completed goal ratio should be serialized");
        VP_EXPECT(weekly.at("tasks_ratio") == 1.0,
                  "the executed task ratio should be serialized");
        VP_EXPECT(weekly.at("productivity_index") == 1.0,
                  "the productivity index should come from ReportingService");
        VP_EXPECT(weekly.at("most_productive_weeks").size() == 1,
                  "the productive ISO week should be serialized");
        expect_complete_bucket(weekly.at("most_productive_weeks").front());

        // Act: mês bissexto sem dados.
        const auto empty_month = get_json(
            client, "/api/reports?period=monthly&date=2024-02-10");

        // Assert
        expect_complete_summary(empty_month);
        VP_EXPECT(empty_month.at("start_date") == "2024-02-01",
                  "a monthly report should start on the first day");
        VP_EXPECT(empty_month.at("end_date") == "2024-02-29",
                  "a monthly report should honor leap years");
        VP_EXPECT(empty_month.at("goals_total") == 0,
                  "an empty period should have zero goals");
        VP_EXPECT(empty_month.at("tasks_total") == 0,
                  "an empty period should have zero tasks");
        VP_EXPECT(empty_month.at("goals_ratio").is_null(),
                  "an empty period should keep goals_ratio null");
        VP_EXPECT(empty_month.at("tasks_ratio").is_null(),
                  "an empty period should keep tasks_ratio null");
        VP_EXPECT(empty_month.at("productivity_index").is_null(),
                  "an empty period should keep productivity_index null");
        VP_EXPECT(empty_month.at("most_productive_weeks").empty(),
                  "an empty period should have no productive week");

        // Act: ano civil.
        const auto yearly = get_json(
            client, "/api/reports?period=yearly&date=2026-08-05");

        // Assert
        VP_EXPECT(yearly.at("start_date") == "2026-01-01",
                  "a yearly report should start on January first");
        VP_EXPECT(yearly.at("end_date") == "2026-12-31",
                  "a yearly report should end on December thirty-first");
        VP_EXPECT(yearly.at("tasks_total") == 2,
                  "the yearly report should include both tasks");
        VP_EXPECT(yearly.at("tasks_ratio") == 0.5,
                  "the yearly task ratio should preserve the service result");

        // Act: resumo do dia civil local do servidor.
        const auto dashboard = get_json(client, "/api/dashboard");

        // Assert
        expect_complete_summary(dashboard);
        VP_EXPECT(dashboard.at("start_date") == dashboard.at("end_date"),
                  "the dashboard should summarize exactly one local day");

        // Act e Assert: parâmetros ausentes ou inválidos.
        expect_validation_error(
            client, "/api/reports?date=2026-08-05");
        expect_validation_error(
            client, "/api/reports?period=weekly");
        expect_validation_error(
            client, "/api/reports?period=daily&date=2026-08-05");
        expect_validation_error(
            client, "/api/reports?period=weekly&date=2026-02-30");

        // --- Isolamento do relatorio (issue #113) -------------------------
        //
        // Agregacao vaza sem mostrar registro: mesmo sem ler a meta alheia,
        // um relatorio global diria a Bob quantas metas existem, de que
        // categorias e em que turnos. O relatorio dele tem de ser vazio.
        const auto bob =
            testing::register_and_login(client, "bob@example.com", "Bob");
        testing::authenticate_as(client, bob);

        const auto bob_report = get_json(
            client, "/api/reports?period=weekly&date=2026-08-05");

        VP_EXPECT(bob_report.at("goals_total") == 0,
                  "another user's goals must not be counted");
        VP_EXPECT(bob_report.at("tasks_total") == 0,
                  "another user's tasks must not be counted");
        VP_EXPECT(bob_report.at("goals_ratio").is_null(),
                  "with nothing of their own the ratio is null, not zero");
        VP_EXPECT(bob_report.at("productivity_index").is_null(),
                  "an empty report must not borrow the other user's index");

        const auto bob_dashboard = get_json(client, "/api/dashboard");

        VP_EXPECT(bob_dashboard.at("tasks_total") == 0,
                  "the dashboard must be scoped to the caller as well");
    });

    return 0;
}
