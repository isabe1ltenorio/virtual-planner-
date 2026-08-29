#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include "virtual_planner/domain/entities/user.hpp"

namespace virtual_planner::persistence {

struct UserCredentials
{
    std::uint64_t user_id;
    std::string password_hash;
};

class UserRepository
{
public:
    virtual ~UserRepository() = default;

    virtual void save(const domain::User& user) = 0;

    virtual std::optional<domain::User> find_by_id(
        std::uint64_t id) = 0;

    virtual std::vector<domain::User> find_all() = 0;

    virtual void remove(std::uint64_t id) = 0;

    virtual std::uint64_t create(const domain::User& user,
                                 const std::string& password_hash) = 0;

    virtual std::optional<UserCredentials> find_credentials_by_email(
        const std::string& email) = 0;
};

} // namespace virtual_planner::persistence
