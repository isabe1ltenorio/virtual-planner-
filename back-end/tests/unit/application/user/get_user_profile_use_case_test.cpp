#include "virtual_planner/application/user/get_user_profile_use_case.hpp"

#include <stdexcept>

#include "support/expect.hpp"
#include "virtual_planner/persistence/memory/in_memory_user_repository.hpp"

using namespace virtual_planner;

namespace {

// Sucesso: o usuario corrente existe no repositorio e execute() devolve o
// perfil dele.
void test_returns_current_user_profile()
{
    persistence::InMemoryUserRepository repository;

    repository.save(
        domain::User(1, "Gabriel", "gabriel@example.com"));

    application::GetUserProfileUseCase get_profile(repository, 1);

    const auto profile = get_profile.execute();

    VP_EXPECT(
        profile.id() == 1,
        "profile must have the current user's id");

    VP_EXPECT(
        profile.name() == "Gabriel",
        "profile must have the current user's name");

    VP_EXPECT(
        profile.email() == "gabriel@example.com",
        "profile must have the current user's email");
}

// Rejeicao: sem o usuario corrente no repositorio, o caso de uso nao pode
// devolver um perfil inventado ou vazio.
void test_throws_when_current_user_is_missing()
{
    persistence::InMemoryUserRepository repository;

    application::GetUserProfileUseCase get_profile(repository, 1);

    bool threw = false;

    try
    {
        [[maybe_unused]] const auto profile = get_profile.execute();
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
    test_returns_current_user_profile();
    test_throws_when_current_user_is_missing();

    return 0;
}