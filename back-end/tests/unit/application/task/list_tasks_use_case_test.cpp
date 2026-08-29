#include "virtual_planner/application/task/list_tasks_use_case.hpp"

#include <chrono>
#include <cstdint>
#include <stdexcept>
#include <string>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"

using namespace virtual_planner;

// Dono usado por todo o arquivo: o contrato do repositorio exige um, e
// nao ha valor que signifique "qualquer um".
constexpr std::uint64_t kOwner = 1;

namespace {

domain::Task task(std::uint64_t id,
                  domain::Date date,
                  domain::Category category,
                  domain::Priority priority,
                  domain::TaskStatus status)
{
    return domain::Task{
        id,
        "Task " + std::to_string(id),
        category,
        date,
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        priority,
        status};
}

} // namespace

int main()
{
    persistence::InMemoryTaskRepository repository;

    repository.save(task(1, domain::Date{5, 8, 2026}, domain::Category::Work,
                         domain::Priority::High, domain::TaskStatus::Executed), kOwner);
    repository.save(task(2, domain::Date{10, 8, 2026}, domain::Category::Study,
                         domain::Priority::High, domain::TaskStatus::Pending), kOwner);
    repository.save(task(3, domain::Date{15, 8, 2026}, domain::Category::Work,
                         domain::Priority::Low, domain::TaskStatus::Executed), kOwner);
    repository.save(task(4, domain::Date{20, 8, 2026}, domain::Category::Work,
                         domain::Priority::High, domain::TaskStatus::Executed), kOwner);
    repository.save(task(5, domain::Date{1, 9, 2026}, domain::Category::Health,
                         domain::Priority::Medium,
                         domain::TaskStatus::Cancelled), kOwner);

    application::ListTasksUseCase use_case(repository);

    // Sem filtro: tudo.
    VP_EXPECT(use_case.execute({}, kOwner).size() == 5,
              "an empty filter should return every task");

    // So intervalo de datas, limites inclusivos.
    {
        application::ListTasksFilter filter;
        filter.start_date = domain::Date{5, 8, 2026};
        filter.end_date = domain::Date{15, 8, 2026};

        const auto result = use_case.execute(filter, kOwner);

        VP_EXPECT(result.size() == 3,
                  "date range should include both boundary dates");
    }

    // So limite inferior.
    {
        application::ListTasksFilter filter;
        filter.start_date = domain::Date{15, 8, 2026};

        VP_EXPECT(use_case.execute(filter, kOwner).size() == 3,
                  "a lone start_date should keep tasks on or after it");
    }

    // So categoria.
    {
        application::ListTasksFilter filter;
        filter.category = domain::Category::Work;

        VP_EXPECT(use_case.execute(filter, kOwner).size() == 3,
                  "category filter should keep only Work tasks");
    }

    // So prioridade.
    {
        application::ListTasksFilter filter;
        filter.priority = domain::Priority::High;

        VP_EXPECT(use_case.execute(filter, kOwner).size() == 3,
                  "priority filter should keep only High tasks");
    }

    // So status.
    {
        application::ListTasksFilter filter;
        filter.status = domain::TaskStatus::Executed;

        VP_EXPECT(use_case.execute(filter, kOwner).size() == 3,
                  "status filter should keep only Executed tasks");
    }

    // Filtros combinados (AND): data + categoria + prioridade + status.
    // So a task 4 satisfaz os quatro ao mesmo tempo.
    {
        application::ListTasksFilter filter;
        filter.start_date = domain::Date{10, 8, 2026};
        filter.end_date = domain::Date{31, 8, 2026};
        filter.category = domain::Category::Work;
        filter.priority = domain::Priority::High;
        filter.status = domain::TaskStatus::Executed;

        const auto result = use_case.execute(filter, kOwner);

        VP_EXPECT(result.size() == 1,
                  "combined filters should narrow to the single matching task");
        VP_EXPECT(result.front().id() == 4,
                  "combined filters should return task 4");
    }

    // Combinacao sem nenhuma task correspondente.
    {
        application::ListTasksFilter filter;
        filter.category = domain::Category::Study;
        filter.status = domain::TaskStatus::Executed;

        VP_EXPECT(use_case.execute(filter, kOwner).empty(),
                  "combined filters with no match should return an empty list");
    }

    // Intervalo invertido: erro, como em ListGoalsUseCase.
    {
        application::ListTasksFilter filter;
        filter.start_date = domain::Date{20, 8, 2026};
        filter.end_date = domain::Date{10, 8, 2026};

        bool rejected = false;

        try
        {
            static_cast<void>(use_case.execute(filter, kOwner));
        }
        catch (const std::invalid_argument&)
        {
            rejected = true;
        }

        VP_EXPECT(rejected, "an inverted date range should be rejected");
    }

    return 0;
}
