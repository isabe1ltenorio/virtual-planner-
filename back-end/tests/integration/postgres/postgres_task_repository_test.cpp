#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>

#include "virtual_planner/infrastructure/postgres/postgres_config.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_database.hpp"
#include "virtual_planner/infrastructure/postgres/postgres_task_repository.hpp"

#include "support/expect.hpp"

#include <cstdint>

using namespace virtual_planner;

// O usuario semeado pela migration 001, dono das linhas deste teste.
constexpr std::uint64_t kOwner = 1;

namespace
{

bool has_postgres_environment()
{
    return std::getenv("POSTGRES_DB") != nullptr &&
           std::getenv("POSTGRES_USER") != nullptr &&
           std::getenv("POSTGRES_PASSWORD") != nullptr;
}

} // namespace

int main()
{
    using infrastructure::postgres::PostgresConfig;
    using infrastructure::postgres::PostgresDatabase;
    using infrastructure::postgres::PostgresTaskRepository;

    if (!has_postgres_environment())
    {
        std::cout
            << "Skipping PostgreSQL task repository test: "
            << "POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD "
            << "are required.\n";

        return 0;
    }

    try
    {
        PostgresDatabase database(PostgresConfig::from_environment());

        database.initialize();
        database.connect();

        PostgresTaskRepository repository(database);

        // Turno da manha (P-18): start_minutes = 480. ReportingService::shift_of
        // deriva o turno de start(); persistir o TimeSlot fielmente e o que
        // mantem o turno correto no round-trip.
        const domain::TimeSlot morning{
            std::chrono::hours{8},
            std::chrono::hours{9} + std::chrono::minutes{30}};

        const domain::Task task(
            0,
            "Escrever o relatorio de integracao",
            domain::Category::Work,
            domain::Date(15, 8, 2026),
            morning,
            domain::Priority::High,
            domain::TaskStatus::Pending);

        // Act: save()
        const auto id = repository.save(task, kOwner);

        VP_EXPECT(id != 0, "save() must return a non-zero id");

        // Assert: find_by_id()
        auto saved = repository.find_by_id(id, kOwner);

        VP_EXPECT(saved.has_value(), "find_by_id() must return the saved task");
        VP_EXPECT(saved->id() == id, "saved task id must match");
        VP_EXPECT(saved->description() == "Escrever o relatorio de integracao",
                  "saved task description must round-trip");
        VP_EXPECT(saved->category() == domain::Category::Work,
                  "saved task category must round-trip");
        VP_EXPECT(saved->date() == domain::Date(15, 8, 2026),
                  "saved task date must round-trip");
        VP_EXPECT(saved->priority() == domain::Priority::High,
                  "saved task priority must round-trip");
        VP_EXPECT(saved->status() == domain::TaskStatus::Pending,
                  "saved task status must round-trip");
        VP_EXPECT(saved->time_slot().start() == std::chrono::minutes{480},
                  "start_minutes must round-trip (morning shift, P-18)");
        VP_EXPECT(saved->time_slot().end() == std::chrono::minutes{570},
                  "end_minutes must round-trip");

        // Assert: find_all()
        const auto all = repository.find_all(kOwner);

        VP_EXPECT(
            std::any_of(all.begin(), all.end(),
                        [id](const domain::Task& t) { return t.id() == id; }),
            "find_all() must include the saved task");

        // Act: update() — move a tarefa para o turno da noite (start = 1140).
        const domain::TimeSlot evening{
            std::chrono::hours{19}, std::chrono::hours{20}};

        const domain::Task edited(
            id,
            "Relatorio revisado",
            domain::Category::PersonalProjects,
            domain::Date(20, 8, 2026),
            evening,
            domain::Priority::Low,
            domain::TaskStatus::Executed);

        repository.update(edited, kOwner);

        // Assert: update()
        auto reloaded = repository.find_by_id(id, kOwner);

        VP_EXPECT(reloaded.has_value(),
                  "find_by_id() must return the updated task");
        VP_EXPECT(reloaded->id() == id, "updated task id must be unchanged");
        VP_EXPECT(reloaded->description() == "Relatorio revisado",
                  "update() must persist the new description");
        VP_EXPECT(reloaded->category() == domain::Category::PersonalProjects,
                  "update() must persist the new category");
        VP_EXPECT(reloaded->date() == domain::Date(20, 8, 2026),
                  "update() must persist the new date");
        VP_EXPECT(reloaded->priority() == domain::Priority::Low,
                  "update() must persist the new priority");
        VP_EXPECT(reloaded->status() == domain::TaskStatus::Executed,
                  "update() must persist the new status");
        VP_EXPECT(reloaded->time_slot().start() == std::chrono::minutes{1140},
                  "update() must persist the new start_minutes (evening shift)");

        // Cleanup
        repository.remove(id, kOwner);

        VP_EXPECT(!repository.find_by_id(id, kOwner).has_value(),
                  "remove() must delete the task");

        database.shutdown();

        VP_EXPECT(!database.is_connected(),
                  "database must be disconnected after shutdown");

        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
