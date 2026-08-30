#pragma once

#include <cstdint>

#include "virtual_planner/domain/entities/user.hpp"
#include "virtual_planner/persistence/user_repository.hpp"

namespace virtual_planner::application {

class GetUserProfileUseCase
{
public:
    GetUserProfileUseCase(
        persistence::UserRepository& repository,
        std::uint64_t current_user_id);

    // Lanca std::runtime_error se o usuario corrente nao existir no
    // repositorio.
    [[nodiscard]] domain::User execute() const;

private:
    persistence::UserRepository& repository_;

    std::uint64_t current_user_id_;
};

} // namespace virtual_planner::application