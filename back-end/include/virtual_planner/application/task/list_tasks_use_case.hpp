#pragma once

#include <optional>
#include <vector>

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/domain/enums/category.hpp"
#include "virtual_planner/domain/enums/priority.hpp"
#include "virtual_planner/domain/enums/task_status.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

// Todos os campos sao opcionais e combinam com AND: um campo vazio nao
// restringe. start_date e end_date formam um intervalo de datas inclusivo;
// cada limite pode existir sozinho. Um filtro sem nenhum campo devolve todas
// as tasks.
struct ListTasksFilter
{
    std::optional<domain::Date> start_date;
    std::optional<domain::Date> end_date;
    std::optional<domain::Category> category;
    std::optional<domain::Priority> priority;
    std::optional<domain::TaskStatus> status;
};

class ListTasksUseCase
{
public:
    explicit ListTasksUseCase(persistence::TaskRepository& repository);

    // Lanca std::invalid_argument quando start_date e end_date existem e
    // start_date e posterior a end_date, como ListGoalsUseCase.
    [[nodiscard]] std::vector<domain::Task> execute(
        const ListTasksFilter& filter) const;

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
