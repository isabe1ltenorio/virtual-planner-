#include <nlohmann/json.hpp>

#include "virtual_planner/api/json/user_json.hpp"
#include "support/expect.hpp"

#include <stdexcept>
#include <string>

using namespace virtual_planner;

namespace {

template <typename Callable>
bool throws_invalid_argument(Callable callable)
{
    try
    {
        callable();
    }
    catch (const std::invalid_argument&)
    {
        return true;
    }
    catch (...)
    {
        return false;
    }

    return false;
}

} // namespace

int main()
{
    // Arrange
    const domain::User original{42, "Alice", "alice@example.com"};

    // Act
    const nlohmann::json serialized = api::json::to_json(original);

    // Assert
    VP_EXPECT(serialized.at("id") == 42,
              "User id should serialize correctly");
    VP_EXPECT(serialized.at("name") == "Alice",
              "User name should serialize correctly");
    VP_EXPECT(serialized.at("email") == "alice@example.com",
              "User email should serialize correctly");

    // Assert: nenhum campo sensivel exposto.
    //
    // A checagem e por tamanho, e nao por ausencia de uma lista de nomes
    // conhecidos: contar as chaves reprova qualquer campo novo que apareca no
    // payload, inclusive um que ninguem pensou em proibir. Uma lista negra so
    // pegaria o que ja esta nela.
    VP_EXPECT(serialized.size() == 3,
              "User payload must expose exactly id, name and email");
    VP_EXPECT(!serialized.contains("password"),
              "User payload must never expose a password");
    VP_EXPECT(!serialized.contains("password_hash"),
              "User payload must never expose a password hash");

    // Act
    const domain::User parsed = api::json::user_from_json(serialized);

    // Assert: round trip
    VP_EXPECT(parsed.id() == original.id(),
              "User id should survive JSON round trip");
    VP_EXPECT(parsed.name() == original.name(),
              "User name should survive JSON round trip");
    VP_EXPECT(parsed.email() == original.email(),
              "User email should survive JSON round trip");

    // Assert: round trip de volta ao JSON produz o mesmo documento, o que
    // fecha o ciclo nos dois sentidos — to_json nao acrescenta nem perde campo
    // ao reserializar o que from_json devolveu.
    VP_EXPECT(api::json::to_json(parsed) == serialized,
              "serializing the parsed User should reproduce the same JSON");

    // Arrange: campos de credencial na entrada
    nlohmann::json with_password = serialized;
    with_password["password"] = "uma-senha-de-verdade";
    nlohmann::json with_hash = serialized;
    with_hash["password_hash"] = "pbkdf2-sha256$1$aa$bb";
    nlohmann::json with_senha = serialized;
    with_senha["senha"] = "uma-senha-de-verdade";

    // Act and Assert
    VP_EXPECT(
        throws_invalid_argument(
            [&with_password] { return api::json::user_from_json(with_password); }),
        "a User payload carrying a password should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&with_hash] { return api::json::user_from_json(with_hash); }),
        "a User payload carrying a password hash should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&with_senha] { return api::json::user_from_json(with_senha); }),
        "a User payload carrying \"senha\" should be rejected");

    // Arrange: entrada malformada
    nlohmann::json fractional_id = serialized;
    fractional_id["id"] = 1.5;
    nlohmann::json negative_id = nlohmann::json::parse(
        R"({"id": -1, "name": "Alice", "email": "alice@example.com"})");
    nlohmann::json string_id = serialized;
    string_id["id"] = "42";
    nlohmann::json numeric_name = serialized;
    numeric_name["name"] = 7;
    nlohmann::json missing_email = serialized;
    missing_email.erase("email");

    // Act and Assert
    VP_EXPECT(
        throws_invalid_argument(
            [&fractional_id] { return api::json::user_from_json(fractional_id); }),
        "a fractional User id should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&negative_id] { return api::json::user_from_json(negative_id); }),
        "a negative User id should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&string_id] { return api::json::user_from_json(string_id); }),
        "a string User id should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&numeric_name] { return api::json::user_from_json(numeric_name); }),
        "a non-string User name should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [&missing_email] { return api::json::user_from_json(missing_email); }),
        "a User without a required field should be rejected");
    VP_EXPECT(
        throws_invalid_argument(
            [] { return api::json::user_from_json(nlohmann::json::array()); }),
        "a non-object User should be rejected");

    // Arrange: valores que o dominio recusa. `domain::User` valida nome e
    // email no construtor, entao a validacao nao precisa ser reimplementada
    // aqui — mas precisa continuar chegando ao chamador como
    // std::invalid_argument, que o mapeamento global traduz para 400.
    nlohmann::json blank_name = serialized;
    blank_name["name"] = "   ";
    nlohmann::json email_without_at = serialized;
    email_without_at["email"] = "alice.example.com";
    nlohmann::json email_without_dot = serialized;
    email_without_dot["email"] = "alice@example";

    // Act and Assert
    VP_EXPECT(
        throws_invalid_argument(
            [&blank_name] { return api::json::user_from_json(blank_name); }),
        "a blank User name should be rejected by the domain");
    VP_EXPECT(
        throws_invalid_argument(
            [&email_without_at] { return api::json::user_from_json(email_without_at); }),
        "a User email without @ should be rejected by the domain");
    VP_EXPECT(
        throws_invalid_argument(
            [&email_without_dot] { return api::json::user_from_json(email_without_dot); }),
        "a User email without a dotted domain should be rejected by the domain");

    // Arrange: id 0 e valido no contrato. `POST /api/auth/register` constroi
    // `domain::User{0, name, email}` antes de o banco atribuir o id, entao
    // recusar 0 quebraria o cadastro.
    //
    // O documento e construido com `parse`, e nao por atribuicao, de proposito.
    // Em nlohmann, `j["id"] = 0` guarda number_integer e reprova em
    // `is_number_unsigned()`, enquanto o mesmo `0` vindo do corpo de uma
    // requisicao parseia como number_unsigned. Atribuir aqui testaria uma
    // situacao que nao existe no fio e acusaria um defeito que nao ha.
    const nlohmann::json unsaved = nlohmann::json::parse(
        R"({"id": 0, "name": "Alice", "email": "alice@example.com"})");

    // Act
    const domain::User parsed_unsaved = api::json::user_from_json(unsaved);

    // Assert
    VP_EXPECT(parsed_unsaved.id() == 0,
              "id 0 should be accepted for a User not yet persisted");

    return 0;
}
