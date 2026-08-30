#pragma once

#include <cstdint>
#include <string>

#include "virtual_planner/domain/entities/user.hpp"
#include "virtual_planner/persistence/user_repository.hpp"

namespace virtual_planner::application {

// Dados novos de perfil. So nome e email: troca de senha nao passa por aqui,
// e um campo de credencial neste struct viraria um caminho de escalonamento
// silencioso no dia em que um endpoint aceitasse o corpo inteiro do cliente.
struct UpdateUserProfileRequest
{
    std::string name;

    std::string email;
};

// Atualiza o perfil (nome e email) do usuario corrente.
//
// Mesma decisao de identidade do GetUserProfileUseCase: o id do usuario
// corrente e injetado no construtor, nunca recebido no corpo de execute().
// Quem constroi o caso de uso tira o id da sessao autenticada; aceita-lo como
// parametro de entrada permitiria pedir o perfil de outra pessoa so trocando
// um numero.
class UpdateUserProfileUseCase
{
public:
    UpdateUserProfileUseCase(
        persistence::UserRepository& repository,
        std::uint64_t current_user_id);

    // Lanca std::runtime_error se o usuario corrente nao existir no
    // repositorio, e std::invalid_argument se nome ou email nao passarem na
    // validacao de dominio (User::validate_name / validate_email).
    void execute(const UpdateUserProfileRequest& request);

private:
    persistence::UserRepository& repository_;

    std::uint64_t current_user_id_;
};

} // namespace virtual_planner::application