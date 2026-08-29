#include "virtual_planner/api/http/api_server.hpp"

#include "virtual_planner/api/http/error_response.hpp"

#include <nlohmann/json.hpp>

#include <optional>
#include <string>
#include <string_view>

namespace virtual_planner::api::http {

ApiServer::ApiServer(const core::AppConfig& config,
                     persistence::RepositorySet repositories,
                     const persistence::Database* database,
                     interfaces::Logger& logger,
                     ServerConfig server_config)
    : config_(config),
      repositories_(repositories),
      database_(database),
      logger_(logger),
      server_config_(std::move(server_config))
{
    register_limits();
    register_authentication_gate();
    register_exception_handler();
    register_cors();
    register_request_log();
    register_health_route();
}

void ApiServer::register_limits()
{
    // Sem limite explicito o httplib aceita corpo de qualquer tamanho, e uma
    // unica requisicao consegue esgotar a memoria do processo. 1 MiB e folgado
    // para os payloads desta API, que sao objetos de dominio pequenos.
    server_.set_payload_max_length(kMaxPayloadBytes);

    // Sem timeout, uma conexao que abre e nao fala prende uma thread do pool
    // ate o fim dos tempos. Poucas conexoes assim derrubam o servidor.
    server_.set_read_timeout(kSocketTimeoutSeconds, 0);
    server_.set_write_timeout(kSocketTimeoutSeconds, 0);
    server_.set_idle_interval(0, kIdleIntervalMicroseconds);
}

httplib::Server& ApiServer::server() noexcept
{
    return server_;
}

const persistence::RepositorySet& ApiServer::repositories() const noexcept
{
    return repositories_;
}

const ServerConfig& ApiServer::server_config() const noexcept
{
    return server_config_;
}

std::optional<std::uint64_t> ApiServer::authenticated_user_id(
    const httplib::Request& request) const
{
    const std::string cookie = request.get_header_value("Cookie");
    constexpr std::string_view name = "vp_session=";
    const std::size_t start = cookie.find(name);

    if (start == std::string::npos)
    {
        return std::nullopt;
    }

    const std::size_t value_start = start + name.size();
    const std::size_t value_end = cookie.find(';', value_start);
    return sessions_.user_id(cookie.substr(value_start, value_end - value_start));
}

void ApiServer::begin_session(httplib::Response& response,
                              std::uint64_t user_id)
{
    std::string cookie = "vp_session=" + sessions_.create(user_id) +
        "; Path=/; HttpOnly; SameSite=Strict";

    if (config_.profile() == core::ExecutionProfile::Production)
    {
        cookie += "; Secure";
    }

    response.set_header("Set-Cookie", cookie);
}

void ApiServer::end_session(const httplib::Request& request,
                            httplib::Response& response)
{
    const std::string cookie = request.get_header_value("Cookie");
    constexpr std::string_view name = "vp_session=";
    const std::size_t start = cookie.find(name);

    if (start != std::string::npos)
    {
        const std::size_t value_start = start + name.size();
        const std::size_t value_end = cookie.find(';', value_start);
        sessions_.remove(cookie.substr(value_start, value_end - value_start));
    }

    response.set_header(
        "Set-Cookie",
        "vp_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
}

int ApiServer::bind(const ServerConfig& config)
{
    // Atencao: o segundo parametro de bind_to_any_port e socket_flags, nao a
    // porta — ele SEMPRE pede uma porta efemera. So bind_to_port aceita uma
    // porta escolhida, e devolve apenas sucesso ou falha, por isso a porta
    // efetiva vem de lugares diferentes nos dois casos.
    if (config.port == 0)
    {
        return server_.bind_to_any_port(config.host);
    }

    return server_.bind_to_port(config.host, config.port) ? config.port : -1;
}

bool ApiServer::serve()
{
    return server_.listen_after_bind();
}

bool ApiServer::listen(const ServerConfig& config)
{
    if (bind(config) < 0)
    {
        return false;
    }

    return serve();
}

void ApiServer::stop()
{
    server_.stop();
}

void ApiServer::register_exception_handler()
{
    server_.set_exception_handler(
        [this](const httplib::Request& request,
               httplib::Response& response,
               std::exception_ptr error) {
            const ErrorResponse mapped = map_exception(error);

            // O detalhe do 500 fica so aqui. A resposta leva uma mensagem
            // generica, porque a original pode carregar connection string ou
            // nome de variavel de ambiente (issue #31).
            if (mapped.status >= 500)
            {
                std::string detail;

                try
                {
                    std::rethrow_exception(error);
                }
                catch (const std::exception& thrown)
                {
                    detail = thrown.what();
                }
                catch (...)
                {
                    detail = "excecao desconhecida";
                }

                logger_.error("unhandled exception",
                              "method=" + request.method + " path=" +
                                  request.path + " detail=\"" + detail + "\"");
            }

            response.status = mapped.status;
            response.set_content(mapped.to_json(), "application/json");
        });
}

void ApiServer::register_cors()
{
    // Roda depois do roteamento, entao vale para /api/health, para as rotas
    // dos donos de modulo e para o 404 padrao — sem ninguem precisar lembrar.
    server_.set_post_routing_handler(
        [this](const httplib::Request& request, httplib::Response& response) {
            const std::string origin = request.get_header_value("Origin");

            if (!server_config_.allows_origin(origin))
            {
                return;
            }

            // Ecoa a origem em vez de devolver "*": com "*" o navegador
            // recusa requisicao com credencial, e a resposta deixa de servir
            // para o dia em que houver login.
            response.set_header("Access-Control-Allow-Origin", origin);

            // Sem Vary, um cache intermediario serviria a resposta de uma
            // origem para outra.
            response.set_header("Vary", "Origin");
            response.set_header("Access-Control-Allow-Credentials", "true");
        });

    // Preflight: o navegador manda OPTIONS antes de um PUT/DELETE ou de um
    // POST com Content-Type: application/json. Sem esta rota o servidor
    // responderia 404 e a requisicao real nunca sairia.
    server_.Options(".*",
                    [this](const httplib::Request& request,
                           httplib::Response& response) {
                        const std::string origin =
                            request.get_header_value("Origin");

                        if (!server_config_.allows_origin(origin))
                        {
                            response.status = 403;
                            return;
                        }

                        response.set_header("Access-Control-Allow-Methods",
                                            "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                        response.set_header("Access-Control-Allow-Headers",
                                            "Content-Type");
                        // Allow-Credentials NAO entra aqui: o post-routing
                        // handler ja o acrescenta em toda resposta, incluindo
                        // esta. Duas ocorrencias do mesmo cabecalho invalidam a
                        // checagem de CORS e o navegador recusa o preflight.
                        response.set_header("Access-Control-Max-Age", "86400");
                        response.status = 204;
                    });
}

void ApiServer::register_authentication_gate()
{
    server_.set_pre_routing_handler(
        [this](const httplib::Request& request, httplib::Response& response) {
            const bool public_route = request.path == "/api/health" ||
                (request.method == "POST" &&
                 (request.path == "/api/auth/register" ||
                  request.path == "/api/auth/login")) ||
                request.method == "OPTIONS";

            if (public_route || authenticated_user_id(request).has_value())
            {
                return httplib::Server::HandlerResponse::Unhandled;
            }

            response.status = 401;
            response.set_header("WWW-Authenticate", "Session");
            response.set_content(
                ErrorResponse{401, "unauthorized", "Autenticacao necessaria."}.to_json(),
                "application/json");
            return httplib::Server::HandlerResponse::Handled;
        });
}

void ApiServer::register_request_log()
{
    // Uma linha por requisicao atendida. Metodo, caminho e status apenas:
    // corpo, query e header ficam de fora de proposito, porque e por ai que
    // credencial vaza para o log (issue #71).
    server_.set_logger([this](const httplib::Request& request,
                              const httplib::Response& response) {
        logger_.info("request",
                     "method=" + request.method + " path=" + request.path +
                         " status=" + std::to_string(response.status));
    });
}

void ApiServer::register_health_route()
{
    server_.Get("/api/health",
                [this](const httplib::Request&, httplib::Response& response) {
                    const bool database_configured = database_ != nullptr;
                    const bool database_connected =
                        database_configured && database_->is_connected();

                    nlohmann::json body;
                    body["app"] = config_.app_name();
                    body["profile"] =
                        std::string{core::to_string(config_.profile())};
                    body["database"] = {
                        {"configured", database_configured},
                        {"connected", database_connected},
                    };

                    // Sempre 200: a resposta chegar ja prova que o processo
                    // esta de pe, que e o que um health check precisa saber.
                    // "degraded" cobre o caso de o banco estar configurado e
                    // fora do ar — informacao para quem consome, nao falha do
                    // servidor.
                    body["status"] =
                        (!database_configured || database_connected)
                            ? "ok"
                            : "degraded";

                    response.set_content(body.dump(), "application/json");
                });
}

} // namespace virtual_planner::api::http
