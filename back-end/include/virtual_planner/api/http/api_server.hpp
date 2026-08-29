#pragma once

// Servidor HTTP da aplicacao (issue #29 / P-28).
//
// Responsabilidades desta classe:
//
// - manter o `httplib::Server` e o ciclo de vida da porta;
// - registrar `GET /api/health`;
// - guardar as dependencias que a composition root montou, para que os donos
//   de modulo registrem os endpoints de dominio a partir delas.
//
// O que ela NAO faz: escolher implementacao concreta de repositorio ou de
// banco. Essa decisao e de `main.cpp`, que continua sendo a composition root.
//
// `httplib.h` aparece neste header de proposito: esta e a camada HTTP, e os
// donos de modulo precisam do `httplib::Server` para registrar as proprias
// rotas em arquivos separados, sem editar `api_server.cpp` — seis pessoas
// mexendo no mesmo arquivo de rotas seria conflito garantido. O que nao pode
// vazar, e nao vaza, e HTTP ou JSON dentro de `domain` e `application`.

#include <httplib.h>

#include <cstddef>
#include <ctime>

#include "virtual_planner/api/http/server_config.hpp"
#include "virtual_planner/api/http/session_store.hpp"
#include "virtual_planner/core/app_config.hpp"
#include "virtual_planner/interfaces/logger.hpp"
#include "virtual_planner/persistence/database.hpp"
#include "virtual_planner/persistence/repository_set.hpp"

namespace virtual_planner::api::http {

class ApiServer
{
public:
    // `config`, `database` e `logger` sao referenciados, nao copiados:
    // precisam viver mais que o servidor. `database` pode ser nulo — a
    // aplicacao sobe e responde sem banco nenhum, e `/api/health` reporta
    // isso.
    ApiServer(const core::AppConfig& config,
              persistence::RepositorySet repositories,
              const persistence::Database* database,
              interfaces::Logger& logger,
              ServerConfig server_config = {});

    // Seam para os donos de modulo registrarem os endpoints de dominio.
    [[nodiscard]] httplib::Server& server() noexcept;

    [[nodiscard]] const persistence::RepositorySet& repositories() const noexcept;

    // Origens de CORS e host/porta padrao. `bind()` sobrescreve host e porta
    // com o que receber, mas as origens vem daqui.
    [[nodiscard]] const ServerConfig& server_config() const noexcept;

    [[nodiscard]] std::optional<std::uint64_t> authenticated_user_id(
        const httplib::Request& request) const;

    void begin_session(httplib::Response& response, std::uint64_t user_id);
    void end_session(const httplib::Request& request,
                     httplib::Response& response);

    // Abre a porta sem comecar a servir. Devolve a porta efetiva — util com
    // `ServerConfig::port == 0`, que pede uma porta efemera ao sistema — ou
    // -1 quando a porta nao pode ser aberta.
    [[nodiscard]] int bind(const ServerConfig& config);

    // Serve ate `stop()`. Exige um `bind()` bem-sucedido antes. Devolve false
    // quando o laco termina por erro.
    bool serve();

    // `bind()` seguido de `serve()`. E o caminho que `main` usa.
    bool listen(const ServerConfig& config);

    // Seguro de chamar de outra thread, que e como os testes derrubam o
    // servidor.
    void stop();

private:
    // Teto do corpo de requisicao e dos timeouts de socket. Ficam aqui, e nao
    // soltos no .cpp, para que um teste consiga afirmar sobre os mesmos valores
    // que o servidor aplica.
    static constexpr std::size_t kMaxPayloadBytes = 1024U * 1024U;
    static constexpr time_t kSocketTimeoutSeconds = 10;
    static constexpr time_t kIdleIntervalMicroseconds = 100000;

    void register_limits();
    void register_health_route();

    // Aplicado a todas as rotas de uma vez: um dono de modulo nao escreve
    // try/catch no handler, so lanca o erro certo (issue #31).
    void register_exception_handler();

    // Cabecalhos de CORS em toda resposta e preflight OPTIONS (issue #32).
    void register_cors();

    // Uma linha por requisicao atendida (issue #71).
    void register_request_log();
    void register_authentication_gate();

    const core::AppConfig& config_;
    persistence::RepositorySet repositories_;
    const persistence::Database* database_;
    interfaces::Logger& logger_;
    ServerConfig server_config_;
    SessionStore sessions_;
    httplib::Server server_;
};

} // namespace virtual_planner::api::http
