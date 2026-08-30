#pragma once

#include <algorithm>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

#include "virtual_planner/persistence/user_repository.hpp"

namespace virtual_planner::persistence {

// Repositorio de User em memoria.
//
// UserRepository nao expoe update, entao save faz upsert: substitui quem ja
// tem o mesmo id e insere caso contrario.
//
// O estado vive em duas listas: users_ guarda o perfil e credentials_ guarda o
// e-mail e o hash usados no login. Quem muda o e-mail pelo perfil chama save(),
// entao save() precisa mover a credencial junto — senao o login passa a exigir
// o e-mail antigo enquanto /api/auth/me devolve o novo, e os dois nunca mais
// concordam.
//
// Nao e thread-safe: o vector interno nao tem lock nenhum. O chamador deve
// serializar o acesso concorrente.
class InMemoryUserRepository final : public UserRepository
{
public:
    void save(const domain::User& user) override
    {
        // E o e-mail que identifica quem faz login. create() ja recusava um
        // e-mail repetido; sem a mesma checagem aqui, uma atualizacao de perfil
        // conseguia produzir dois usuarios com o mesmo e-mail pelas costas.
        for (const auto& current : users_)
        {
            if (current.id() != user.id() && current.email() == user.email())
            {
                throw std::invalid_argument("User email is already registered.");
            }
        }

        for (auto& current : users_)
        {
            if (current.id() == user.id())
            {
                current = user;
                sync_credential_email(user);
                return;
            }
        }

        users_.push_back(user);
        sync_credential_email(user);
    }

    std::optional<domain::User> find_by_id(std::uint64_t id) override
    {
        for (const auto& user : users_)
        {
            if (user.id() == id)
            {
                return user;
            }
        }

        return std::nullopt;
    }

    std::vector<domain::User> find_all() override
    {
        return users_;
    }

    void remove(std::uint64_t id) override
    {
        users_.erase(
            std::remove_if(
                users_.begin(),
                users_.end(),
                [id](const domain::User& user)
                {
                    return user.id() == id;
                }),
            users_.end());
    }

    std::uint64_t create(const domain::User& user,
                         const std::string& password_hash) override
    {
        for (const auto& current : credentials_)
        {
            if (current.email == user.email())
            {
                throw std::invalid_argument("User email is already registered.");
            }
        }

        const std::uint64_t id = next_id_++;
        users_.emplace_back(id, user.name(), user.email());
        credentials_.push_back(Credential{id, user.email(), password_hash});
        return id;
    }

    std::optional<UserCredentials> find_credentials_by_email(
        const std::string& email) override
    {
        for (const auto& credential : credentials_)
        {
            if (credential.email == email)
            {
                return UserCredentials{credential.user_id, credential.password_hash};
            }
        }

        return std::nullopt;
    }

private:
    // Um usuario criado direto por save(), sem passar por create(), nao tem
    // credencial: nesse caso nao ha nada para mover, e o laco simplesmente
    // nao encontra o id.
    void sync_credential_email(const domain::User& user)
    {
        for (auto& credential : credentials_)
        {
            if (credential.user_id == user.id())
            {
                credential.email = user.email();
                return;
            }
        }
    }

    struct Credential
    {
        std::uint64_t user_id;
        std::string email;
        std::string password_hash;
    };

    std::vector<domain::User> users_;
    std::vector<Credential> credentials_;
    std::uint64_t next_id_{1};
};

} // namespace virtual_planner::persistence
