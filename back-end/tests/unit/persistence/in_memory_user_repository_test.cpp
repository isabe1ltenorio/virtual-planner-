#include "virtual_planner/persistence/memory/repositories.hpp"

#include "support/expect.hpp"

using namespace virtual_planner;

int main()
{
    // Este teste inclui o header de conveniencia de proposito: se ele quebrar,
    // quebra aqui, e nao dentro do modulo de quem for consumir os quatro.
    persistence::InMemoryGoalRepository goals;
    persistence::InMemoryTaskRepository tasks;
    persistence::InMemoryReminderRepository reminders;

    VP_EXPECT(goals.find_all(1).empty(), "convenience header should expose a usable goal repository");
    VP_EXPECT(tasks.find_all(1).empty(), "convenience header should expose a usable task repository");
    VP_EXPECT(reminders.find_all().empty(), "convenience header should expose a usable reminder repository");

    persistence::InMemoryUserRepository repository;

    VP_EXPECT(repository.find_all().empty(), "repository should start empty");
    VP_EXPECT(!repository.find_by_id(1).has_value(), "find_by_id should return nullopt when empty");

    const domain::User first{1, "Laysa", "laysa@example.com"};

    repository.save(first);

    VP_EXPECT(repository.find_all().size() == 1, "repository should hold one user after save");

    const auto stored = repository.find_by_id(1);

    VP_EXPECT(stored.has_value(), "saved user should be retrievable by its own id");
    VP_EXPECT(stored->id() == 1, "save must preserve the entity id");
    VP_EXPECT(stored->name() == "Laysa", "name should round-trip");
    VP_EXPECT(stored->email() == "laysa@example.com", "email should round-trip");

    const domain::User second{2, "Bel", "bel@example.com"};

    repository.save(second);

    VP_EXPECT(repository.find_all().size() == 2, "repository should hold two users");

    const domain::User first_edited{1, "Laysa Beatriz", "laysa.beatriz@example.com"};

    repository.save(first_edited);

    VP_EXPECT(repository.find_all().size() == 2, "save with an existing id must upsert, not append");

    const auto after_upsert = repository.find_by_id(1);

    VP_EXPECT(after_upsert.has_value(), "upserted user should still exist");
    VP_EXPECT(after_upsert->name() == "Laysa Beatriz", "upsert should replace the name");
    VP_EXPECT(after_upsert->email() == "laysa.beatriz@example.com", "upsert should replace the email");
    VP_EXPECT(repository.find_by_id(2)->name() == "Bel", "upsert must not touch other users");

    repository.remove(1);

    VP_EXPECT(repository.find_all().size() == 1, "remove should drop exactly one user");
    VP_EXPECT(!repository.find_by_id(1).has_value(), "removed user should no longer be retrievable");
    VP_EXPECT(repository.find_by_id(2).has_value(), "remove must not touch other users");

    repository.remove(4242);

    VP_EXPECT(repository.find_all().size() == 1, "remove of an unknown id must be a no-op");

    return 0;
}
