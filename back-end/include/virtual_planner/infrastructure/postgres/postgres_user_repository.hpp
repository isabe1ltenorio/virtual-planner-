#pragma once
#include <cstdint>

#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/persistence/user_repository.hpp"

#if defined(VIRTUAL_PLANNER_WITH_POSTGRES)

namespace virtual_planner::infrastructure::postgres
{

class PostgresUserRepository final
    : public persistence::UserRepository
{
public:
    explicit PostgresUserRepository(PostgresDatabase& database);

    void save(const domain::User& user) override;

    std::optional<domain::User> find_by_id(std::uint64_t id) override;

    std::vector<domain::User> find_all() override;

    void remove(std::uint64_t id) override;

    std::uint64_t create(const domain::User& user,
                         const std::string& password_hash) override;

    std::optional<persistence::UserCredentials> find_credentials_by_email(
        const std::string& email) override;

private:
    PostgresDatabase& database_;
};

} // namespace virtual_planner::infrastructure::postgres

#endif
