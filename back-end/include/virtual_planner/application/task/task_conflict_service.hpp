#pragma once

#include <vector>

#include "virtual_planner/domain/entities/task.hpp"
#include "virtual_planner/domain/value_objects/date.hpp"
#include "virtual_planner/persistence/task_repository.hpp"

namespace virtual_planner::application {

// Par de tarefas cujo horario se sobrepoe no mesmo dia. `first` e a tarefa que
// aparece antes na ordem do repositorio; `second` a seguinte.
struct TaskConflict
{
    domain::Task first;
    domain::Task second;
};

// Deteccao de conflito de horario entre tarefas de um mesmo dia (P-24).
//
// DECISAO (P-24, ADR-004 em docs/architecture.md): o servico apenas ALERTA,
// nunca bloqueia. CreateTaskUseCase e UpdateTaskUseCase seguem intocados — o
// dominio permite sobreposicao de proposito e a resolucao do conflito e
// responsabilidade da visualizacao do planner (P-41).
//
// Regras:
//  - so compara tarefas cuja Task::date() e igual a data pedida;
//  - ignora tarefas Cancelled e Postponed: elas nao ocupam o horario;
//  - usa TimeSlot::overlaps, cuja semantica de adjacencia ja esta travada por
//    teste — um slot que termina as 10:00 nao conflita com um que comeca as
//    10:00;
//  - cada par conflitante aparece uma unica vez, na ordem do repositorio.
//
// Lembretes ficam de fora: TaskRepository nao os conhece e os arquivos de
// Reminder estao fora do escopo desta issue.
class TaskConflictService
{
public:
    explicit TaskConflictService(persistence::TaskRepository& repository);

    [[nodiscard]] std::vector<TaskConflict> conflicts_on(
        const domain::Date& date) const;

private:
    persistence::TaskRepository& repository_;
};

} // namespace virtual_planner::application
