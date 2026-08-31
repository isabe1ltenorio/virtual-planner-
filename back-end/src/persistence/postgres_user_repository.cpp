#include "virtual_planner/infrastructure/postgres/postgres_user_repository.hpp"
#include <pqxx/pqxx>

namespace virtual_planner::infrastructure::postgres {

PostgresUserRepository::PostgresUserRepository(std::shared_ptr<PostgresDatabase> database)
    : database_(std::move(database)) {}

domain::User PostgresUserRepository::save(const domain::User& user) {
    auto conn = database_->get_connection();
    pqxx::work txn(*conn);

    if (user.id() == 0) {
        // Criar novo usuário (INSERT)
        pqxx::row row = txn.exec_params1(
            "INSERT INTO users (name, email, password_hash) "
            "VALUES ($1, $2, $3) RETURNING id",
            user.name(),
            user.email(),
            user.password_hash()
        );
        txn.commit();
        
        return domain::User{
            row[0].as<int>(),
            user.name(),
            user.email(),
            user.password_hash()
        };
    } else {
        // Atualizar usuário existente (UPDATE)
        txn.exec_params(
            "UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4",
            user.name(),
            user.email(),
            user.password_hash(),
            user.id()
        );
        txn.commit();
        return user;
    }
}

std::optional<domain::User> PostgresUserRepository::find_by_id(int id) const {
    auto conn = database_->get_connection();
    pqxx::work txn(*conn);

    pqxx::result res = txn.exec_params(
        "SELECT id, name, email, password_hash FROM users WHERE id = $1", 
        id
    );

    if (res.empty()) {
        return std::nullopt;
    }

    const auto& row = res[0];
    return domain::User{
        row[0].as<int>(),
        row[1].as<std::string>(),
        row[2].as<std::string>(),
        row[3].as<std::string>()
    };
}

std::optional<domain::User> PostgresUserRepository::find_by_email(const std::string& email) const {
    auto conn = database_->get_connection();
    pqxx::work txn(*conn);

    pqxx::result res = txn.exec_params(
        "SELECT id, name, email, password_hash FROM users WHERE email = $1", 
        email
    );

    if (res.empty()) {
        return std::nullopt;
    }

    const auto& row = res[0];
    return domain::User{
        row[0].as<int>(),
        row[1].as<std::string>(),
        row[2].as<std::string>(),
        row[3].as<std::string>()
    };
}

} // namespace virtual_planner::infrastructure::postgres