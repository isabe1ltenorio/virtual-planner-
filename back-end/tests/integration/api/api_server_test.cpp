// P-28: teste de integracao do servidor HTTP.
//
// Sobe o servidor de verdade em uma porta efemera de 127.0.0.1 e fala com ele
// por um cliente HTTP. Testar o handler de /api/health direto, sem servidor,
// nao provaria o criterio de aceite: o que precisa ficar demonstrado e que a
// aplicacao sobe e responde, com e sem banco.
#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/api/http/routes/auth_routes.hpp"
#include "virtual_planner/api/http/error_response.hpp"
#include "virtual_planner/api/http/server_config.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/memory/repositories.hpp"
#include "virtual_planner/persistence/repository_set.hpp"
#include "virtual_planner/shared/errors.hpp"
#include "support/authenticated_client.hpp"
#include "support/expect.hpp"
#include "virtual_planner/shared/errors.hpp"

#include <nlohmann/json.hpp>

#include <cstdlib>
#include <string>
#include <cstddef>
#include <mutex>
#include <thread>
#include <vector>

using namespace virtual_planner;
namespace http_api = virtual_planner::api::http;

namespace
{

// Database concreta sem banco nenhum atras: os hooks virtuais de
// persistence::Database ja tem implementacao vazia, entao connect() apenas
// leva o estado para Connected. Serve para exercitar o relato de /api/health
// sem exigir PostgreSQL no CI.
class FakeDatabase final : public persistence::Database
{
};

// Guarda as linhas em memoria em vez de imprimir, para que o teste possa
// afirmar o que foi logado. Respeita o nivel minimo como o ConsoleLogger.
class RecordingLogger final : public interfaces::Logger
{
public:
    explicit RecordingLogger(
        interfaces::LogLevel minimum = interfaces::LogLevel::Debug)
        : minimum_(minimum)
    {
    }

    void log(interfaces::LogLevel level,
             std::string_view message,
             std::string_view fields) override
    {
        if (static_cast<int>(level) < static_cast<int>(minimum_))
        {
            return;
        }

        const std::lock_guard<std::mutex> guard(mutex_);
        lines_.push_back(std::string{interfaces::to_string(level)} + " " +
                         std::string{message} + " " + std::string{fields});
    }

    [[nodiscard]] std::vector<std::string> lines()
    {
        const std::lock_guard<std::mutex> guard(mutex_);
        return lines_;
    }

    [[nodiscard]] bool has_line_containing(std::string_view needle)
    {
        for (const auto& line : lines())
        {
            if (line.find(needle) != std::string::npos)
            {
                return true;
            }
        }

        return false;
    }

private:
    interfaces::LogLevel minimum_;
    std::vector<std::string> lines_;
    std::mutex mutex_;
};

template <typename Callable>
void with_running_server(http_api::ApiServer& server, Callable callable)
{
    http_api::ServerConfig config;
    config.host = "127.0.0.1";
    // Porta 0: o sistema escolhe uma porta livre. Fixar uma porta faria o
    // teste falhar de forma intermitente sempre que algo ja estivesse nela.
    config.port = 0;

    const int port = server.bind(config);
    VP_EXPECT(port > 0, "server should bind an ephemeral port");

    std::thread serving([&server] { server.serve(); });
    server.server().wait_until_ready();

    httplib::Client client("127.0.0.1", port);
    client.set_read_timeout(5, 0);

    callable(client);

    server.stop();
    serving.join();
}

// `Vary` pode aparecer mais de uma vez na resposta: o httplib acrescenta o
// seu (`Accept-Encoding`) quando negocia compressao, e o CORS acrescenta
// `Origin`. Dois cabecalhos Vary separados equivalem a uma lista unica
// separada por virgula, entao isso e HTTP valido — mas get_header_value(key)
// devolve so o primeiro, por isso a busca percorre todos.
bool has_header_value(const httplib::Response& response,
                      const char* key,
                      std::string_view expected)
{
    for (std::size_t index = 0; index < response.get_header_value_count(key); ++index)
    {
        // O indice e o TERCEIRO parametro; o segundo e o valor padrao.
        if (response.get_header_value(key, "", index) == expected)
        {
            return true;
        }
    }

    return false;
}

persistence::RepositorySet make_repositories(
    persistence::InMemoryGoalRepository& goals,
    persistence::InMemoryTaskRepository& tasks,
    persistence::InMemoryReminderRepository& reminders,
    persistence::InMemoryUserRepository& users)
{
    return persistence::RepositorySet{&goals, &tasks, &reminders, &users};
}

bool throws_config_error(const char* port_value)
{
    if (port_value == nullptr)
    {
        ::unsetenv("VP_HTTP_PORT");
    }
    else
    {
        ::setenv("VP_HTTP_PORT", port_value, 1);
    }

    try
    {
        static_cast<void>(http_api::ServerConfig::from_environment());
    }
    catch (const shared::ConfigError&)
    {
        ::unsetenv("VP_HTTP_PORT");
        return true;
    }

    ::unsetenv("VP_HTTP_PORT");
    return false;
}

} // namespace

int main()
{
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;
    persistence::InMemoryUserRepository users;

    const auto repositories = make_repositories(goals, tasks, reminders, users);
    RecordingLogger logger;
    const core::AppConfig config{"virtual-planner-test",
                                 core::ExecutionProfile::Test};

    // --- Sem banco: a aplicacao sobe e responde mesmo assim ----------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};

        with_running_server(server, [](httplib::Client& client) {
            const auto response = client.Get("/api/health");

            VP_EXPECT(static_cast<bool>(response), "GET /api/health should answer");
            VP_EXPECT(response->status == 200, "/api/health should answer 200");
            VP_EXPECT(
                response->get_header_value("Content-Type") == "application/json",
                "/api/health should answer application/json");

            const auto body = nlohmann::json::parse(response->body);

            VP_EXPECT(body.at("app") == "virtual-planner-test",
                      "/api/health should report the configured app name");
            VP_EXPECT(body.at("profile") == "test",
                      "/api/health should report the execution profile");
            VP_EXPECT(body.at("status") == "ok",
                      "without a database the status should be ok");
            VP_EXPECT(body.at("database").at("configured") == false,
                      "without a database it should not be reported as configured");
            VP_EXPECT(body.at("database").at("connected") == false,
                      "without a database it should not be reported as connected");
        });
    }

    // --- Com banco conectado -----------------------------------------------
    {
        FakeDatabase database;
        database.connect();
        VP_EXPECT(database.is_connected(), "the fake database should be connected");

        http_api::ApiServer server{config, repositories, &database, logger};

        with_running_server(server, [](httplib::Client& client) {
            const auto response = client.Get("/api/health");

            VP_EXPECT(static_cast<bool>(response), "GET /api/health should answer");
            VP_EXPECT(response->status == 200, "/api/health should answer 200");

            const auto body = nlohmann::json::parse(response->body);

            VP_EXPECT(body.at("status") == "ok",
                      "a connected database should keep the status ok");
            VP_EXPECT(body.at("database").at("configured") == true,
                      "a wired database should be reported as configured");
            VP_EXPECT(body.at("database").at("connected") == true,
                      "a connected database should be reported as connected");
        });
    }

    // --- Com banco configurado mas fora do ar ------------------------------
    {
        // Construida e nunca conectada: e o cenario de banco caido.
        FakeDatabase database;
        VP_EXPECT(!database.is_connected(),
                  "a database that never connected should not be connected");

        http_api::ApiServer server{config, repositories, &database, logger};

        with_running_server(server, [](httplib::Client& client) {
            const auto response = client.Get("/api/health");

            VP_EXPECT(static_cast<bool>(response), "GET /api/health should answer");
            VP_EXPECT(response->status == 200,
                      "a database that is down should still answer 200");

            const auto body = nlohmann::json::parse(response->body);

            VP_EXPECT(body.at("status") == "degraded",
                      "a configured database that is down should degrade the status");
            VP_EXPECT(body.at("database").at("configured") == true,
                      "the database should still be reported as configured");
            VP_EXPECT(body.at("database").at("connected") == false,
                      "a database that is down should not be reported as connected");
        });
    }

    // --- Rota desconhecida --------------------------------------------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};
        http_api::register_auth_routes(server);

        with_running_server(server, [](httplib::Client& client) {
            // Sem sessao, o gate responde antes do roteamento. E deliberado
            // que a resposta seja 401 e nao 404: um 404 para rota inexistente
            // e 401 para rota existente deixaria qualquer anonimo mapear a
            // superficie da API so variando o caminho.
            const auto anonymous = client.Get("/api/does-not-exist");

            VP_EXPECT(static_cast<bool>(anonymous),
                      "an unknown route should answer");
            VP_EXPECT(anonymous->status == 401,
                      "an unauthenticated request must not reveal whether the "
                      "route exists");

            // Autenticado, o 404 volta a ser 404.
            const auto user = testing::register_and_login(
                client, "route-probe@example.com", "Prober");
            testing::authenticate_as(client, user);

            const auto authenticated = client.Get("/api/does-not-exist");

            VP_EXPECT(static_cast<bool>(authenticated),
                      "an unknown route should answer for an authenticated caller");
            VP_EXPECT(authenticated->status == 404,
                      "an authenticated request to an unknown route should answer 404");
        });
    }

    // --- Repositorios entregues pela composition root ----------------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};

        VP_EXPECT(server.repositories().goals == &goals,
                  "the server should keep the goal repository it was given");
        VP_EXPECT(server.repositories().tasks == &tasks,
                  "the server should keep the task repository it was given");
        VP_EXPECT(server.repositories().reminders == &reminders,
                  "the server should keep the reminder repository it was given");
        VP_EXPECT(server.repositories().users == &users,
                  "the server should keep the user repository it was given");
    }

    // --- Porta explicita ----------------------------------------------------
    //
    // Regressao: bind_to_any_port(host, flags) recebe socket_flags no segundo
    // parametro, nao a porta, e sempre abre uma porta efemera. Passar a porta
    // ali fazia o servidor subir em uma porta aleatoria enquanto o log dizia
    // outra. Os cenarios acima usam porta 0 e nao pegariam isso.
    {
        // Descobre uma porta livre deixando o sistema escolher uma e
        // devolvendo-a em seguida.
        //
        // O stop() aqui NAO e opcional. httplib::Server tem destrutor
        // defaulted: sair de escopo nao fecha o socket de escuta, e stop() e a
        // unica coisa que libera o descritor — o comentario dele no httplib.h
        // diz exatamente isso. Sem stop(), o probe vira um listener orfao na
        // porta, sem ninguem chamando accept.
        //
        // E ai o detalhe que transforma o vazamento em teste intermitente:
        // httplib liga SO_REUSEPORT por padrao, nao SO_REUSEADDR. Com
        // SO_REUSEPORT o servidor real consegue abrir a MESMA porta, os dois
        // sockets ficam escutando, e o kernel distribui as conexoes entre
        // eles. As que caem no orfao nunca sao aceitas e morrem no timeout de
        // leitura. Foi assim que este teste falhou no CI enquanto passava na
        // maquina local.
        int free_port = 0;
        {
            httplib::Server probe;
            free_port = probe.bind_to_any_port("127.0.0.1");
            VP_EXPECT(free_port > 0, "the probe should find a free port");
            probe.stop();
        }

        // Guarda do proprio vazamento descrito acima: se o probe tivesse
        // deixado o socket aberto, alguem ainda estaria escutando nesta porta
        // agora, e o connect passaria em vez de ser recusado. Sem esta
        // assercao, remover o stop() acima volta a produzir uma falha
        // intermitente e dificil de rastrear em vez de um erro direto.
        {
            httplib::Client leak_check("127.0.0.1", free_port);
            leak_check.set_connection_timeout(1, 0);

            VP_EXPECT(
                leak_check.Get("/api/health").error() == httplib::Error::Connection,
                "the probe must release the port before the server binds it");
        }

        http_api::ServerConfig config_with_port;
        config_with_port.host = "127.0.0.1";
        config_with_port.port = free_port;

        http_api::ApiServer server{config, repositories, nullptr, logger};

        const int bound = server.bind(config_with_port);
        VP_EXPECT(bound == free_port,
                  "bind should return exactly the port that was asked for");

        std::thread serving([&server] { server.serve(); });
        server.server().wait_until_ready();

        httplib::Client client("127.0.0.1", free_port);
        client.set_read_timeout(5, 0);

        const auto response = client.Get("/api/health");

        server.stop();
        serving.join();

        VP_EXPECT(static_cast<bool>(response),
                  "the server should answer on the port that was asked for");
        VP_EXPECT(response->status == 200,
                  "/api/health should answer 200 on an explicit port");
    }

    // --- CORS (issue #32) ---------------------------------------------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};

        with_running_server(server, [](httplib::Client& client) {
            // Origem permitida: o padrao e o servidor de dev do Vite.
            client.set_default_headers({{"Origin", "http://localhost:5173"}});

            const auto allowed = client.Get("/api/health");

            VP_EXPECT(static_cast<bool>(allowed), "GET com Origin deve responder");
            VP_EXPECT(allowed->get_header_value("Access-Control-Allow-Origin") ==
                          "http://localhost:5173",
                      "a origem permitida deve ser ecoada, nao substituida por '*'");
            VP_EXPECT(has_header_value(*allowed, "Vary", "Origin"),
                      "a resposta com CORS deve variar por Origin");
        });
    }

    {
        http_api::ApiServer server{config, repositories, nullptr, logger};

        with_running_server(server, [](httplib::Client& client) {
            client.set_default_headers({{"Origin", "http://evil.example"}});

            const auto blocked = client.Get("/api/health");

            VP_EXPECT(static_cast<bool>(blocked), "uma origem nao permitida ainda recebe resposta");
            VP_EXPECT(blocked->get_header_value("Access-Control-Allow-Origin").empty(),
                      "uma origem nao permitida nao pode receber o cabecalho de CORS");
        });
    }

    {
        http_api::ApiServer server{config, repositories, nullptr, logger};

        with_running_server(server, [](httplib::Client& client) {
            httplib::Headers preflight{{"Origin", "http://localhost:5173"}};

            const auto response = client.Options("/api/goals", preflight);

            VP_EXPECT(static_cast<bool>(response), "o preflight deve responder");
            VP_EXPECT(response->status == 204,
                      "o preflight de uma origem permitida deve responder 204");
            VP_EXPECT(response->get_header_value("Access-Control-Allow-Methods")
                              .find("DELETE") != std::string::npos,
                      "o preflight deve anunciar os metodos permitidos");
            VP_EXPECT(response->get_header_value("Access-Control-Allow-Headers") ==
                          "Content-Type",
                      "o preflight deve permitir o Content-Type usado em JSON");

            const auto forbidden = client.Options(
                "/api/goals", httplib::Headers{{"Origin", "http://evil.example"}});

            VP_EXPECT(static_cast<bool>(forbidden), "o preflight barrado deve responder");
            VP_EXPECT(forbidden->status == 403,
                      "o preflight de uma origem nao permitida deve ser recusado");
        });
    }

    // --- Mapeamento de erro de dominio para HTTP (issue #31) -----------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};
        http_api::register_auth_routes(server);

        // Estas rotas existem so no teste e usam exatamente o seam que os
        // donos de modulo vao usar: lancar o erro certo, sem try/catch.
        server.server().Get("/throws/domain", [](const httplib::Request&, httplib::Response&) {
            throw shared::DomainError("descricao em branco");
        });
        server.server().Get("/throws/not-found", [](const httplib::Request&, httplib::Response&) {
            throw shared::NotFoundError("lembrete nao encontrado");
        });
        server.server().Get("/throws/conflict", [](const httplib::Request&, httplib::Response&) {
            throw shared::ConflictError("ja existe");
        });
        server.server().Get("/throws/invalid", [](const httplib::Request&, httplib::Response&) {
            throw std::invalid_argument("data invalida");
        });
        server.server().Get("/throws/persistence", [](const httplib::Request&, httplib::Response&) {
            throw shared::PersistenceError(
                "connection failed: postgresql://virtual_planner:s3cr3t@localhost/db");
        });

        with_running_server(server, [](httplib::Client& client) {
            // O gate de sessao roda antes do roteamento: sem cookie estas
            // rotas responderiam 401 e o mapeamento nunca seria exercitado.
            const auto user = testing::register_and_login(
                client, "errors@example.com", "Errors");
            testing::authenticate_as(client, user);

            const auto domain_error = client.Get("/throws/domain");
            VP_EXPECT(domain_error->status == 400, "DomainError deve virar 400");
            VP_EXPECT(domain_error->get_header_value("Content-Type") == "application/json",
                      "o corpo de erro deve ser JSON");

            const auto domain_body = nlohmann::json::parse(domain_error->body);
            VP_EXPECT(domain_body.at("error").at("code") == "validation_error",
                      "DomainError deve usar o code validation_error");
            VP_EXPECT(domain_body.at("error").at("message") == "descricao em branco",
                      "o erro de validacao deve preservar a mensagem de dominio");

            const auto not_found = client.Get("/throws/not-found");
            VP_EXPECT(not_found->status == 404, "NotFoundError deve virar 404");
            VP_EXPECT(nlohmann::json::parse(not_found->body).at("error").at("code") == "not_found",
                      "NotFoundError deve usar o code not_found");

            const auto conflict = client.Get("/throws/conflict");
            VP_EXPECT(conflict->status == 409, "ConflictError deve virar 409");
            VP_EXPECT(nlohmann::json::parse(conflict->body).at("error").at("code") == "conflict",
                      "ConflictError deve usar o code conflict");

            const auto invalid = client.Get("/throws/invalid");
            VP_EXPECT(invalid->status == 400,
                      "std::invalid_argument dos value objects deve virar 400");

            // O ponto mais importante: o 500 nao pode devolver a mensagem
            // original, que aqui carrega uma connection string com senha.
            const auto internal = client.Get("/throws/persistence");
            VP_EXPECT(internal->status == 500, "PersistenceError deve virar 500");
            VP_EXPECT(internal->body.find("s3cr3t") == std::string::npos,
                      "a resposta de erro nao pode vazar a senha");
            VP_EXPECT(internal->body.find("postgresql://") == std::string::npos,
                      "a resposta de erro nao pode vazar a connection string");
            VP_EXPECT(nlohmann::json::parse(internal->body).at("error").at("code") == "internal_error",
                      "um erro inesperado deve usar o code internal_error");
        });

        // O detalhe suprimido da resposta precisa existir no log do servidor,
        // senao o operador fica sem nada para investigar.
        VP_EXPECT(logger.has_line_containing("unhandled exception"),
                  "um 500 deve gerar uma linha de log de erro");
        VP_EXPECT(logger.has_line_containing("s3cr3t"),
                  "o detalhe suprimido da resposta deve estar no log do servidor");
    }

    // --- Log de requisicao (issue #71) --------------------------------------
    {
        RecordingLogger request_logger;
        http_api::ApiServer server{config, repositories, nullptr, request_logger};

        with_running_server(server, [](httplib::Client& client) {
            const auto response = client.Get("/api/health");
            VP_EXPECT(static_cast<bool>(response), "a requisicao deve responder");
        });

        VP_EXPECT(request_logger.has_line_containing("method=GET"),
                  "a linha de log deve registrar o metodo");
        VP_EXPECT(request_logger.has_line_containing("path=/api/health"),
                  "a linha de log deve registrar o caminho");
        VP_EXPECT(request_logger.has_line_containing("status=200"),
                  "a linha de log deve registrar o status");
    }

    {
        // Nivel configuravel: em Error, a linha de requisicao (Info) some.
        RecordingLogger quiet_logger{interfaces::LogLevel::Error};
        http_api::ApiServer server{config, repositories, nullptr, quiet_logger};

        with_running_server(server, [](httplib::Client& client) {
            static_cast<void>(client.Get("/api/health"));
        });

        VP_EXPECT(!quiet_logger.has_line_containing("method=GET"),
                  "com nivel Error a requisicao bem-sucedida nao deve ser logada");
    }

    // --- ServerConfig::from_environment ------------------------------------
    ::unsetenv("VP_HTTP_HOST");
    ::unsetenv("VP_HTTP_PORT");

    {
        const auto defaults = http_api::ServerConfig::from_environment();
        VP_EXPECT(defaults.host == "0.0.0.0", "the default host should be 0.0.0.0");
        VP_EXPECT(defaults.port == 8080, "the default port should be 8080");
    }

    {
        ::setenv("VP_HTTP_HOST", "127.0.0.1", 1);
        ::setenv("VP_HTTP_PORT", "9090", 1);

        const auto from_environment = http_api::ServerConfig::from_environment();
        VP_EXPECT(from_environment.host == "127.0.0.1",
                  "VP_HTTP_HOST should override the default host");
        VP_EXPECT(from_environment.port == 9090,
                  "VP_HTTP_PORT should override the default port");

        ::unsetenv("VP_HTTP_HOST");
        ::unsetenv("VP_HTTP_PORT");
    }

    {
        // Variavel presente e vazia deve cair no padrao, nao virar host vazio.
        ::setenv("VP_HTTP_HOST", "", 1);
        const auto empty_host = http_api::ServerConfig::from_environment();
        VP_EXPECT(empty_host.host == "0.0.0.0",
                  "an empty VP_HTTP_HOST should fall back to the default");
        ::unsetenv("VP_HTTP_HOST");
    }

    VP_EXPECT(throws_config_error("not-a-number"),
              "a non-numeric VP_HTTP_PORT should be rejected");
    VP_EXPECT(throws_config_error("8080abc"),
              "a partially numeric VP_HTTP_PORT should be rejected");
    VP_EXPECT(throws_config_error("70000"),
              "a VP_HTTP_PORT above 65535 should be rejected");
    VP_EXPECT(throws_config_error("-1"),
              "a negative VP_HTTP_PORT should be rejected");
    VP_EXPECT(!throws_config_error("0"),
              "VP_HTTP_PORT 0 is valid and means an ephemeral port");

    // --- Limite de corpo: uma requisicao nao derruba o processo -------------
    {
        http_api::ApiServer server{config, repositories, nullptr, logger};
        http_api::register_auth_routes(server);

        // Rota que so existe neste teste: ela nao pode nem ser alcancada, o
        // corpo tem de ser recusado antes de chegar ao handler.
        bool handler_reached = false;
        server.server().Post(
            "/test/echo",
            [&handler_reached](const httplib::Request&,
                               httplib::Response& response) {
                handler_reached = true;
                response.status = 200;
            });

        with_running_server(server, [&handler_reached](httplib::Client& client) {
            const auto user = testing::register_and_login(
                client, "payload@example.com", "Payload");
            testing::authenticate_as(client, user);
            handler_reached = false;

            // Abaixo do teto de 1 MiB: passa e chega no handler.
            const std::string small(64 * 1024, 'x');
            const auto accepted =
                client.Post("/test/echo", small, "application/octet-stream");

            VP_EXPECT(static_cast<bool>(accepted),
                      "a request below the payload limit should answer");
            VP_EXPECT(accepted->status == 200,
                      "a request below the payload limit should be served");
            VP_EXPECT(handler_reached,
                      "a request below the payload limit should reach the handler");

            handler_reached = false;

            // Acima do teto: o servidor recusa antes de alocar o corpo inteiro.
            const std::string huge(2 * 1024 * 1024, 'x');
            const auto refused =
                client.Post("/test/echo", huge, "application/octet-stream");

            VP_EXPECT(static_cast<bool>(refused),
                      "a request above the payload limit should still answer");
            VP_EXPECT(refused->status == 413,
                      "a request above the payload limit should answer 413");
            VP_EXPECT(!handler_reached,
                      "a request above the payload limit must not reach the handler");
        });
    }

    return 0;
}
