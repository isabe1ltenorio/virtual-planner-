#include "virtual_planner/application/task/change_task_status_use_case.hpp"

#include <chrono>
#include <string_view>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_task_repository.hpp"
#include "virtual_planner/shared/errors.hpp"

using namespace virtual_planner;

namespace {

void expect_status_change(application::ChangeTaskStatusUseCase& use_case,
                          persistence::InMemoryTaskRepository& repository,
                          domain::TaskStatus target,
                          std::string_view message)
{
    use_case.execute(application::ChangeTaskStatusRequest{1, target});

    auto stored = repository.find_by_id(1);

    VP_EXPECT(stored.has_value(), "task must exist after a status change");
    VP_EXPECT(stored->status() == target, message);
    VP_EXPECT(repository.find_all().size() == 1,
              "changing status must not create a second row");
}

} // namespace

int main()
{
    persistence::InMemoryTaskRepository repository;

    repository.save(domain::Task{
        1,
        "Study paradigms",
        domain::Category::Study,
        domain::Date{15, 8, 2026},
        domain::TimeSlot{std::chrono::hours{9}, std::chrono::hours{10}},
        domain::Priority::Medium,
        domain::TaskStatus::Pending});

    application::ChangeTaskStatusUseCase use_case(repository);

    expect_status_change(use_case, repository, domain::TaskStatus::Executed,
                         "status should become Executed");
    expect_status_change(use_case, repository,
                         domain::TaskStatus::PartiallyExecuted,
                         "status should become PartiallyExecuted");
    expect_status_change(use_case, repository, domain::TaskStatus::Cancelled,
                         "status should become Cancelled");
    expect_status_change(use_case, repository, domain::TaskStatus::Postponed,
                         "status should become Postponed");
    expect_status_change(use_case, repository, domain::TaskStatus::Pending,
                         "status should be allowed to return to Pending");

    bool not_found_thrown = false;

    try
    {
        use_case.execute(application::ChangeTaskStatusRequest{
            999, domain::TaskStatus::Executed});
    }
    catch (const shared::NotFoundError&)
    {
        not_found_thrown = true;
    }

    VP_EXPECT(not_found_thrown,
              "changing status of a missing task should throw NotFoundError");

    return 0;
}
