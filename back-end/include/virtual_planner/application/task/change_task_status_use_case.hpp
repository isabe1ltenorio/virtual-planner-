#pragma once

#include <cstdint>

#include "virtual_planner/domain/enums/task_status.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

struct ChangeTaskStatusRequest
{
    std::uint64_t id;
    domain::TaskStatus status;
};

// Aceita qualquer valor de TaskStatus, sem maquina de estados, como
// ChangeGoalStatusUseCase. O switch e exaustivo de proposito: um enumerador
// novo em TaskStatus quebra a compilacao aqui ate ser tratado.
class ChangeTaskStatusUseCase
{
public:
    explicit ChangeTaskStatusUseCase(persistence::TaskRepository& repository);

    // Lanca shared::NotFoundError quando nao existe Task com o id pedido.
    void execute(const ChangeTaskStatusRequest& request);

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
