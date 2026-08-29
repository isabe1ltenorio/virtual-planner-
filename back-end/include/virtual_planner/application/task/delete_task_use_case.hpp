#pragma once

#include <cstdint>

#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

class DeleteTaskUseCase
{
public:
    explicit DeleteTaskUseCase(persistence::TaskRepository& repository);

    // Lanca shared::NotFoundError quando nao existe Task com o id pedido.
    void execute(std::uint64_t id, std::uint64_t user_id);

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
