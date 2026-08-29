#pragma once

// Apoio para os testes de integracao da API depois que a autenticacao passou a
// existir (issues #111, #112 e #113).
//
// Antes, um teste chamava /api/goals direto. Com o gate de sessao ligado, toda
// rota que nao seja /api/health ou /api/auth/* responde 401 sem cookie. Este
// header registra um usuario pelo endpoint real, faz login e devolve o cookie
// pronto para ser fixado no cliente.
//
// Usa os endpoints de verdade de proposito, em vez de semear a sessao por
// dentro: assim o proprio caminho de autenticacao entra na cobertura, e um
// teste de Goal quebra se o login quebrar.

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "support/expect.hpp"

#include <cstdint>
#include <string>

namespace virtual_planner::testing {

struct AuthenticatedUser
{
    std::uint64_t id{0};
    std::string session_cookie;
};

// Extrai apenas o par `vp_session=<valor>` do Set-Cookie, descartando os
// atributos (Path, HttpOnly, SameSite). E o formato que o cabecalho `Cookie`
// da requisicao espera de volta.
inline std::string session_cookie_from(const httplib::Response& response)
{
    const std::string set_cookie = response.get_header_value("Set-Cookie");
    const std::size_t end = set_cookie.find(';');

    return end == std::string::npos ? set_cookie : set_cookie.substr(0, end);
}

// Registra e autentica um usuario, devolvendo o id e o cookie de sessao.
inline AuthenticatedUser register_and_login(httplib::Client& client,
                                            const std::string& email,
                                            const std::string& name = "Tester")
{
    // A senha precisa passar pela regra de tamanho minimo de auth_routes.
    const std::string password = "senha-de-teste-123";

    const nlohmann::json registration{
        {"name", name},
        {"email", email},
        {"password", password},
    };

    const auto registered = client.Post(
        "/api/auth/register", registration.dump(), "application/json");

    VP_EXPECT(static_cast<bool>(registered), "register should answer");
    VP_EXPECT(registered->status == 201,
              "registering a new user should answer 201");

    const auto created = nlohmann::json::parse(registered->body);

    const nlohmann::json credentials{
        {"email", email},
        {"password", password},
    };

    const auto logged_in = client.Post(
        "/api/auth/login", credentials.dump(), "application/json");

    VP_EXPECT(static_cast<bool>(logged_in), "login should answer");
    VP_EXPECT(logged_in->status == 204,
              "logging in with the right password should answer 204");

    AuthenticatedUser user;
    user.id = created.at("id").get<std::uint64_t>();
    user.session_cookie = session_cookie_from(*logged_in);

    VP_EXPECT(!user.session_cookie.empty(),
              "login should set a session cookie");

    return user;
}

// Passa a enviar o cookie em toda requisicao seguinte deste cliente.
inline void authenticate_as(httplib::Client& client,
                            const AuthenticatedUser& user)
{
    client.set_default_headers({{"Cookie", user.session_cookie}});
}

} // namespace virtual_planner::testing
