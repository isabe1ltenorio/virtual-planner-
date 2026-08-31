#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/routes/user_routes.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"

#include "support/authenticated_client.hpp"
#include "support/expect.hpp"

#include <nlohmann/json.hpp>

#include <string>
#include <string_view>
#include <thread>

using namespace virtual_planner;
namespace http_api = virtual_planner::api::http;

namespace {

class SilentLogger final : public interfaces::Logger
{
public:
    void log(interfaces::LogLevel, std::string_view, std::string_view) override
    {
    }
};

void expect_error(const httplib::Result& response, int status, const char* code)
{
    VP_EXPECT(static_cast<bool>(response), "the request should answer");
    VP_EXPECT(response->status == status, "the error should have the expected status");
    VP_EXPECT(response->get_header_value("Content-Type") == "application/json",
              "errors should use the shared JSON contract");
    const auto body = nlohmann::json::parse(response->body);
    VP_EXPECT(body.at("error").at("code") == code,
              "the error should have the expected code");
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;
    persistence::RepositorySet repositories{&goals, &tasks, &reminders, &users};
    SilentLogger logger;
    const core::AppConfig config{"virtual-planner-user-test",
                                 core::ExecutionProfile::Test};
    http_api::ApiServer server{config, repositories, nullptr, logger};
    http_api::register_auth_routes(server);
    http_api::register_user_routes(server);

    http_api::ServerConfig server_config;
    server_config.host = "127.0.0.1";
    server_config.port = 0;
    const int port = server.bind(server_config);
    VP_EXPECT(port > 0, "the user server should bind an ephemeral port");
    std::thread serving([&server] { server.serve(); });
    server.server().wait_until_ready();
    httplib::Client client{"127.0.0.1", port};
    client.set_read_timeout(5, 0);

    // Anonymous requests are rejected before profile data is read or changed.
    expect_error(client.Get("/api/users/me"), 401, "unauthorized");
    expect_error(client.Patch("/api/users/me", "{}", "application/json"),
                 401, "unauthorized");

    const auto alice = testing::register_and_login(client, "alice@example.com", "Alice");
    const auto bob = testing::register_and_login(client, "bob@example.com", "Bob");
    testing::authenticate_as(client, alice);

    const auto initial = client.Get("/api/users/me");
    VP_EXPECT(static_cast<bool>(initial), "GET /api/users/me should answer");
    VP_EXPECT(initial->status == 200, "the current profile should answer 200");
    VP_EXPECT(initial->get_header_value("Content-Type") == "application/json",
              "the current profile should be JSON");
    const nlohmann::json alice_profile{
        {"id", alice.id}, {"name", "Alice"}, {"email", "alice@example.com"}};
    VP_EXPECT(nlohmann::json::parse(initial->body) == alice_profile,
              "the profile must expose exactly the caller id, name and email");

    // The URL and query cannot select another user's profile.
    const auto queried = client.Get("/api/users/me?user_id=" + std::to_string(bob.id));
    VP_EXPECT(queried->status == 200 && nlohmann::json::parse(queried->body) == alice_profile,
              "a query owner must not override the session owner");
    VP_EXPECT(client.Get("/api/users/" + std::to_string(bob.id))->status == 404,
              "profiles must not be readable by arbitrary id");

    const auto renamed = client.Patch("/api/users/me", R"({"name":"Alice Updated"})",
                                      "application/json");
    VP_EXPECT(renamed->status == 200, "a partial name update should succeed");
    auto updated_profile = alice_profile;
    updated_profile["name"] = "Alice Updated";
    VP_EXPECT(nlohmann::json::parse(renamed->body) == updated_profile,
              "a name update must preserve the email and id");

    const std::string invalid_payloads[] = {
        "{", "[]", R"({"name":null})", R"({"email":42})",
        R"({"name":"   "})", R"({"email":"invalid-email"})",
        R"({"name":"Should Not Persist","email":"invalid-email"})",
        R"({"name":"Should Not Persist","id":2})",
        R"({"user_id":2})", R"({"password":"changed-password"})",
        R"({"password_hash":"changed-hash"})", R"({"credentials":{}})",
        R"({"senha":"changed-password"})", R"({"unexpected":true})",
    };
    for (const auto& payload : invalid_payloads)
    {
        expect_error(client.Patch("/api/users/me", payload, "application/json"),
                     400, "validation_error");
        const auto unchanged = client.Get("/api/users/me");
        VP_EXPECT(unchanged->status == 200 &&
                      nlohmann::json::parse(unchanged->body) == updated_profile,
                  "a rejected payload must not partially persist the profile");
    }

    expect_error(client.Patch("/api/users/me",
                               R"({"name":"Should Not Persist","email":"bob@example.com"})",
                               "application/json"),
                 409, "conflict");
    VP_EXPECT(nlohmann::json::parse(client.Get("/api/users/me")->body) == updated_profile,
              "an email collision must leave the profile unchanged");

    const auto email_changed = client.Patch("/api/users/me",
                                            R"({"email":"alice.updated@example.com"})",
                                            "application/json");
    VP_EXPECT(email_changed->status == 200, "a partial email update should succeed");
    updated_profile["email"] = "alice.updated@example.com";
    VP_EXPECT(nlohmann::json::parse(email_changed->body) == updated_profile,
              "an email update must preserve the name and id");
    VP_EXPECT(nlohmann::json::parse(client.Get("/api/auth/me")->body) == updated_profile,
              "auth identity and user profile must stay synchronized");

    testing::authenticate_as(client, bob);
    const nlohmann::json bob_profile{
        {"id", bob.id}, {"name", "Bob"}, {"email", "bob@example.com"}};
    VP_EXPECT(nlohmann::json::parse(client.Get("/api/users/me")->body) == bob_profile,
              "changing Alice must not modify Bob's profile");

    // Both users can still log in with their own unchanged passwords.
    client.set_default_headers({});
    expect_error(client.Post("/api/auth/login",
                              R"({"email":"alice@example.com","password":"senha-de-teste-123"})",
                              "application/json"),
                 401, "invalid_credentials");
    const auto alice_login = client.Post("/api/auth/login",
                                         R"({"email":"alice.updated@example.com","password":"senha-de-teste-123"})",
                                         "application/json");
    VP_EXPECT(alice_login->status == 204, "Alice must log in using the new email and old password");
    client.set_default_headers({{"Cookie", testing::session_cookie_from(*alice_login)}});
    VP_EXPECT(nlohmann::json::parse(client.Get("/api/users/me")->body) == updated_profile,
              "a fresh session must read the updated profile");
    const auto bob_login = client.Post("/api/auth/login",
                                       R"({"email":"bob@example.com","password":"senha-de-teste-123"})",
                                       "application/json");
    VP_EXPECT(bob_login->status == 204, "Bob's credentials must stay unchanged");

    expect_error(client.Post("/api/auth/register",
                              R"({"name":"Duplicate","email":"bob@example.com","password":"senha-de-teste-123"})",
                              "application/json"),
                 409, "conflict");

    server.stop();
    serving.join();
    return 0;
}
