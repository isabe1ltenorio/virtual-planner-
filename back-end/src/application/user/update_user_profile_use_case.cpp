#include "virtual_planner/application/user/update_user_profile_use_case.hpp"

#include <stdexcept>

namespace virtual_planner::application {

UpdateUserProfileUseCase::UpdateUserProfileUseCase(
    persistence::UserRepository& repository,
    std::uint64_t current_user_id)
    : repository_(repository)
    , current_user_id_(current_user_id)
{
}

void UpdateUserProfileUseCase::execute(
    const UpdateUserProfileRequest& request)
{
    auto user = repository_.find_by_id(current_user_id_);

    if (!user.has_value())
    {
        throw std::runtime_error(
            "Current user not found for the given id.");
    }

    // update_name/update_email validam nome e email e lancam
    // std::invalid_argument em caso de dado invalido. Esta camada
    // deixa a excecao propagar em vez de reinterpretar o erro de dominio.
    user->update_name(request.name);

    user->update_email(request.email);

    // UserRepository nao expoe update(): save() faz upsert (ver
    // in_memory_user_repository.hpp), entao regrava o mesmo id.
    repository_.save(*user);
}

} // namespace virtual_planner::application