#include "virtual_planner/infrastructure/postgres/postgres_user_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

#include <cstdint>
#include <pqxx/pqxx>

namespace virtual_planner::infrastructure::postgres {

namespace {

domain::User user_from_row(const pqxx::row_ref& row)
{
    return domain::User{
        row["id"].as<std::uint64_t>(),
        row["name"].as<std::string>(),
        row["email"].as<std::string>()};
}

} // namespace

PostgresUserRepository::PostgresUserRepository(PostgresDatabase& database)
    : database_(database)
{
}

// UserRepository nao expoe update(): save() regrava o mesmo id (ver
// in_memory_user_repository.hpp e UpdateUserProfileUseCase), sempre chamado
// depois de um find_by_id bem-sucedido, entao aqui e apenas UPDATE.
void PostgresUserRepository::save(const domain::User& user)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        "UPDATE users SET name = $1, email = $2 WHERE id = $3",
        pqxx::params{transaction, user.name(), user.email(), user.id()})
        .no_rows();

    transaction.commit();
}

std::optional<domain::User> PostgresUserRepository::find_by_id(std::uint64_t id)
{
    pqxx::read_transaction transaction(database_.connection());

    const auto result = transaction.exec(
        "SELECT id, name, email FROM users WHERE id = $1",
        pqxx::params{transaction, id});

    if (result.empty())
    {
        return std::nullopt;
    }

    return user_from_row(result.front());
}

std::vector<domain::User> PostgresUserRepository::find_all()
{
    pqxx::read_transaction transaction(database_.connection());

    const auto result = transaction.exec(
        "SELECT id, name, email FROM users ORDER BY id");

    std::vector<domain::User> users;
    users.reserve(result.size());

    for (const auto& row : result)
    {
        users.push_back(user_from_row(row));
    }

    return users;
}

void PostgresUserRepository::remove(std::uint64_t id)
{
    pqxx::work transaction(database_.connection());

    transaction.exec(
        "DELETE FROM users WHERE id = $1",
        pqxx::params{transaction, id}).no_rows();

    transaction.commit();
}

std::uint64_t PostgresUserRepository::create(
    const domain::User& user, const std::string& password_hash)
{
    pqxx::work transaction(database_.connection());

    const auto result = transaction.exec(
        "INSERT INTO users (name, email, password_hash) "
        "VALUES ($1, $2, $3) RETURNING id",
        pqxx::params{transaction, user.name(), user.email(), password_hash});

    const auto id = result.one_row()["id"].as<std::uint64_t>();

    transaction.commit();

    return id;
}

std::optional<persistence::UserCredentials>
PostgresUserRepository::find_credentials_by_email(const std::string& email)
{
    pqxx::read_transaction transaction(database_.connection());

    const auto result = transaction.exec(
        "SELECT id, password_hash FROM users WHERE email = $1",
        pqxx::params{transaction, email});

    if (result.empty())
    {
        return std::nullopt;
    }

    const auto& row = result.front();
    return persistence::UserCredentials{
        row["id"].as<std::uint64_t>(),
        row["password_hash"].as<std::string>()};
}

} // namespace virtual_planner::infrastructure::postgres

#endif
