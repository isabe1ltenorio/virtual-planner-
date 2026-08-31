#include "virtual_planner/api/json/user_json.hpp"

#include <array>
#include <cstdint>
#include <stdexcept>
#include <string>

namespace virtual_planner::api::json {

namespace {

const nlohmann::json& required_field(const nlohmann::json& value,
                                     const char* field)
{
    if (!value.contains(field))
    {
        throw std::invalid_argument(
            std::string{"User requires the field \""} + field + "\".");
    }

    return value.at(field);
}

std::uint64_t read_id(const nlohmann::json& value)
{
    const nlohmann::json& id = required_field(value, "id");

    if (!id.is_number_unsigned())
    {
        throw std::invalid_argument(
            "User field \"id\" must be an unsigned integer.");
    }

    return id.get<std::uint64_t>();
}

std::string read_string(const nlohmann::json& value, const char* field)
{
    const nlohmann::json& found = required_field(value, field);

    if (!found.is_string())
    {
        throw std::invalid_argument(
            std::string{"User field \""} + field + "\" must be a string.");
    }

    return found.get<std::string>();
}

// Nomes de campo que nunca fazem parte do perfil. A lista cobre o nome usado na
// coluna (`password_hash`), o usado no corpo de /api/auth/register e login
// (`password`) e o equivalente em portugues, que e o erro mais provavel de quem
// escreve um cliente novo.
void reject_credential_fields(const nlohmann::json& value)
{
    constexpr std::array<const char*, 4> credential_fields{
        "password",
        "password_hash",
        "senha",
        "credentials",
    };

    for (const char* field : credential_fields)
    {
        if (value.contains(field))
        {
            throw std::invalid_argument(
                std::string{"User must not carry the credential field \""} +
                field + "\". Credentials never travel in the profile payload.");
        }
    }
}

} // namespace

nlohmann::json to_json(const domain::User& user)
{
    return nlohmann::json{
        {"id", user.id()},
        {"name", user.name()},
        {"email", user.email()},
    };
}

domain::User user_from_json(const nlohmann::json& value)
{
    if (!value.is_object())
    {
        throw std::invalid_argument("User must be a JSON object.");
    }

    reject_credential_fields(value);

    // A ordem importa: os tres campos sao lidos e validados como JSON antes de
    // construir `domain::User`, que valida nome e email e lanca por conta
    // propria. Assim um corpo com o tipo errado falha com mensagem sobre o
    // campo, nao com a mensagem de dominio.
    const auto id = read_id(value);
    auto name = read_string(value, "name");
    auto email = read_string(value, "email");

    return domain::User{id, std::move(name), std::move(email)};
}

} // namespace virtual_planner::api::json
