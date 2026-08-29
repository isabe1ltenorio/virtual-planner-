#pragma once

#include <cstdint>

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

class GetTaskUseCase
{
public:
    explicit GetTaskUseCase(persistence::TaskRepository& repository);

    // Lanca shared::NotFoundError quando nao existe Task com o id pedido.
    [[nodiscard]] domain::Task execute(std::uint64_t id) const;

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
