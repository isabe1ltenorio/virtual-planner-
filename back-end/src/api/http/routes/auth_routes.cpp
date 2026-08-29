#include "virtual_planner/api/http/routes/auth_routes.hpp"

#include "virtual_planner/api/http/api_server.hpp"
#include "virtual_planner/domain/entities/user.hpp"

#include <array>
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>
#include <string_view>

namespace virtual_planner::api::http {

namespace {

constexpr int kPasswordIterations = 210000;

std::string hexadecimal(const unsigned char* bytes, std::size_t length)
{
    constexpr char digits[] = "0123456789abcdef";
    std::string result;
    result.reserve(length * 2);

    for (std::size_t index = 0; index < length; ++index)
    {
        result.push_back(digits[bytes[index] >> 4U]);
        result.push_back(digits[bytes[index] & 0x0FU]);
    }

    return result;
}

std::optional<std::string> bytes_from_hex(std::string_view value)
{
    if (value.size() % 2 != 0)
    {
        return std::nullopt;
    }

    std::string result;
    result.reserve(value.size() / 2);

    const auto digit = [](char value) -> int {
        if (value >= '0' && value <= '9') return value - '0';
        if (value >= 'a' && value <= 'f') return value - 'a' + 10;
        if (value >= 'A' && value <= 'F') return value - 'A' + 10;
        return -1;
    };

    for (std::size_t index = 0; index < value.size(); index += 2)
    {
        const int high = digit(value[index]);
        const int low = digit(value[index + 1]);
        if (high < 0 || low < 0) return std::nullopt;
        result.push_back(static_cast<char>((high << 4) | low));
    }

    return result;
}

std::string password_hash(const std::string& password)
{
    std::array<unsigned char, 16> salt{};
    std::array<unsigned char, 32> derived{};

    if (RAND_bytes(salt.data(), static_cast<int>(salt.size())) != 1 ||
        PKCS5_PBKDF2_HMAC(
            password.c_str(), static_cast<int>(password.size()),
            salt.data(), static_cast<int>(salt.size()), kPasswordIterations,
            EVP_sha256(), static_cast<int>(derived.size()), derived.data()) != 1)
    {
        throw std::runtime_error("Could not derive password credentials.");
    }

    return "pbkdf2-sha256$" + std::to_string(kPasswordIterations) + "$" +
        hexadecimal(salt.data(), salt.size()) + "$" +
        hexadecimal(derived.data(), derived.size());
}

bool verifies_password(const std::string& password, const std::string& encoded)
{
    const std::size_t first = encoded.find('$');
    const std::size_t second = encoded.find('$', first + 1);
    const std::size_t third = encoded.find('$', second + 1);
    if (first == std::string::npos || second == std::string::npos ||
        third == std::string::npos || encoded.substr(0, first) != "pbkdf2-sha256")
    {
        return false;
    }

    int iterations{};
    try { iterations = std::stoi(encoded.substr(first + 1, second - first - 1)); }
    catch (const std::exception&) { return false; }
    if (iterations < 1) return false;

    const auto salt = bytes_from_hex(encoded.substr(second + 1, third - second - 1));
    const auto expected = bytes_from_hex(encoded.substr(third + 1));
    if (!salt.has_value() || !expected.has_value() || expected->size() != 32) return false;

    std::array<unsigned char, 32> actual{};
    if (PKCS5_PBKDF2_HMAC(password.c_str(), static_cast<int>(password.size()),
                          reinterpret_cast<const unsigned char*>(salt->data()),
                          static_cast<int>(salt->size()), iterations, EVP_sha256(),
                          static_cast<int>(actual.size()), actual.data()) != 1)
    {
        return false;
    }

    return CRYPTO_memcmp(actual.data(), expected->data(), actual.size()) == 0;
}

nlohmann::json body(const httplib::Request& request)
{
    try
    {
        const auto value = nlohmann::json::parse(request.body);
        if (!value.is_object()) throw std::invalid_argument("Auth payload must be an object.");
        return value;
    }
    catch (const nlohmann::json::exception&)
    {
        throw std::invalid_argument("Invalid JSON payload.");
    }
}

std::string required_string(const nlohmann::json& body, const char* name)
{
    if (!body.contains(name) || !body.at(name).is_string())
    {
        throw std::invalid_argument(std::string{"Auth requires string field \""} + name + "\".");
    }
    return body.at(name).get<std::string>();
}

void validate_password(const std::string& password)
{
    if (password.size() < 12)
    {
        throw std::invalid_argument("Password must contain at least 12 characters.");
    }
}

} // namespace

void register_auth_routes(ApiServer& api)
{
    persistence::UserRepository* users = api.repositories().users;
    if (users == nullptr) throw std::logic_error("User repository is not configured.");

    api.server().Post("/api/auth/register", [users](const httplib::Request& request,
                                                     httplib::Response& response) {
        const nlohmann::json payload = body(request);
        const std::string name = required_string(payload, "name");
        const std::string email = required_string(payload, "email");
        const std::string password = required_string(payload, "password");
        validate_password(password);
        const domain::User user{0, name, email};
        const std::uint64_t id = users->create(user, password_hash(password));
        response.status = 201;
        response.set_content(nlohmann::json{{"id", id}, {"email", email}}.dump(), "application/json");
    });

    api.server().Post("/api/auth/login", [&api, users](const httplib::Request& request,
                                                         httplib::Response& response) {
        const nlohmann::json payload = body(request);
        const std::string email = required_string(payload, "email");
        const std::string password = required_string(payload, "password");
        const auto credentials = users->find_credentials_by_email(email);
        if (!credentials.has_value() || !verifies_password(password, credentials->password_hash))
        {
            response.status = 401;
            response.set_content(
                nlohmann::json{{"error", {{"code", "invalid_credentials"},
                                           {"message", "Credenciais invalidas."}}}}.dump(),
                "application/json");
            return;
        }
        api.begin_session(response, credentials->user_id);
        response.status = 204;
    });

    api.server().Post("/api/auth/logout", [&api](const httplib::Request& request,
                                                   httplib::Response& response) {
        api.end_session(request, response);
        response.status = 204;
    });

    // Quem sou eu. Sem isto o frontend so descobre que perdeu a sessao ao
    // receber 401 numa chamada de dominio — e ai ja renderizou uma tela vazia.
    // O gate de autenticacao ja recusa quem nao tem sessao, entao chegar aqui
    // significa estar autenticado.
    api.server().Get("/api/auth/me", [&api, users](const httplib::Request& request,
                                                    httplib::Response& response) {
        const auto user_id = api.authenticated_user_id(request);

        if (!user_id.has_value())
        {
            throw std::logic_error(
                "Auth route reached without an authenticated caller.");
        }

        const auto user = users->find_by_id(*user_id);

        if (!user.has_value())
        {
            // A sessao aponta para um usuario que sumiu — acontece hoje quando
            // o processo reinicia, porque UserRepository so existe em memoria.
            api.end_session(request, response);
            response.status = 401;
            response.set_content(
                nlohmann::json{{"error", {{"code", "unauthorized"},
                                           {"message", "Sessao expirada."}}}}.dump(),
                "application/json");
            return;
        }

        response.set_content(
            nlohmann::json{{"id", user->id()},
                           {"name", user->name()},
                           {"email", user->email()}}.dump(),
            "application/json");
    });
}

} // namespace virtual_planner::api::http
