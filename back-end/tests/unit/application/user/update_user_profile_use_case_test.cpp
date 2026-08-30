#include "virtual_planner/application/user/update_user_profile_use_case.hpp"

#include <stdexcept>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_user_repository.hpp"

using namespace virtual_planner;

namespace {

// Sucesso: nome e email validos sao persistidos no usuario corrente
// (P-22B, criterio "casos de uso com teste unitario").
void test_updates_current_user_profile()
{
    persistence::InMemoryUserRepository repository;

    repository.save(
        domain::User(1, "Old Name", "old@example.com"));

    application::UpdateUserProfileUseCase update_profile(repository, 1);

    update_profile.execute(
        application::UpdateUserProfileRequest{
            "New Name",
            "new@example.com"
        });

    const auto stored = repository.find_by_id(1);

    VP_EXPECT(
        stored.has_value(),
        "current user must still exist after update");

    VP_EXPECT(
        stored->name() == "New Name",
        "stored user must have the new name");

    VP_EXPECT(
        stored->email() == "new@example.com",
        "stored user must have the new email");
}

// Rejeicao: nome vazio nao pode ser persistido. A regra de validacao e a
// mesma do dominio (User::validate_name); este caso de uso so
// confirma que a excecao propaga e que nada e alterado no repositorio.
void test_rejects_blank_name_without_persisting()
{
    persistence::InMemoryUserRepository repository;

    repository.save(
        domain::User(1, "Old Name", "old@example.com"));

    application::UpdateUserProfileUseCase update_profile(repository, 1);

    bool threw = false;

    try
    {
        update_profile.execute(
            application::UpdateUserProfileRequest{
                "",
                "new@example.com"
            });
    }
    catch (const std::invalid_argument&)
    {
        threw = true;
    }

    VP_EXPECT(
        threw,
        "must throw std::invalid_argument for a blank name");

    const auto stored = repository.find_by_id(1);

    VP_EXPECT(
        stored->name() == "Old Name",
        "a rejected update must not change the stored name");

    VP_EXPECT(
        stored->email() == "old@example.com",
        "a rejected update must not change the stored email");
}

// Rejeicao: email fora da regra minima documentada em User::validate_email
// tambem deve ser rejeitado, sem alterar o repositorio.
void test_rejects_invalid_email_without_persisting()
{
    persistence::InMemoryUserRepository repository;

    repository.save(
        domain::User(1, "Old Name", "old@example.com"));

    application::UpdateUserProfileUseCase update_profile(repository, 1);

    bool threw = false;

    try
    {
        update_profile.execute(
            application::UpdateUserProfileRequest{
                "New Name",
                "invalid-email"
            });
    }
    catch (const std::invalid_argument&)
    {
        threw = true;
    }

    VP_EXPECT(
        threw,
        "must throw std::invalid_argument for an invalid email");

    const auto stored = repository.find_by_id(1);

    VP_EXPECT(
        stored->name() == "Old Name",
        "a rejected update must not change the stored name");

    VP_EXPECT(
        stored->email() == "old@example.com",
        "a rejected update must not change the stored email");
}

// Rejeicao: sem o usuario corrente no repositorio nao ha o que atualizar.
void test_throws_when_current_user_is_missing()
{
    persistence::InMemoryUserRepository repository;

    application::UpdateUserProfileUseCase update_profile(repository, 1);

    bool threw = false;

    try
    {
        update_profile.execute(
            application::UpdateUserProfileRequest{
                "New Name",
                "new@example.com"
            });
    }
    catch (const std::runtime_error&)
    {
        threw = true;
    }

    VP_EXPECT(
        threw,
        "must throw std::runtime_error when the current user does not "
        "exist in the repository");
}

} // namespace

int main()
{
    test_updates_current_user_profile();
    test_rejects_blank_name_without_persisting();
    test_rejects_invalid_email_without_persisting();
    test_throws_when_current_user_is_missing();

    return 0;
}