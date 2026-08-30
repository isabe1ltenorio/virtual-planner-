#include "virtual_planner/application/user/get_user_profile_use_case.hpp"

#include <stdexcept>

namespace virtual_planner::application {

GetUserProfileUseCase::GetUserProfileUseCase(
    persistence::UserRepository& repository,
    std::uint64_t current_user_id)
    : repository_(repository)
    , current_user_id_(current_user_id)
{
}

domain::User GetUserProfileUseCase::execute() const
{
    auto user = repository_.find_by_id(current_user_id_);

    if (!user.has_value())
    {
        throw std::runtime_error(
            "Current user not found for the given id.");
    }

    return *user;
}

} // namespace virtual_planner::application