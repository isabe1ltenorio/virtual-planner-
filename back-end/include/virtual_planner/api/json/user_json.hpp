#pragma once

// Serializacao JSON de `User`.
//
// O payload tem exatamente tres campos: `id`, `name` e `email`. Nenhum campo de
// credencial entra aqui, nem na saida nem na entrada — ver o comentario de
// `user_from_json`. `domain::User` sequer guarda senha: a credencial vive so na
// tabela `users` e sai do repositorio por `find_credentials_by_email`, que
// devolve `persistence::UserCredentials` e nunca passa por esta camada.
//
// Diferente de Goal, Task e Reminder, `User` nao consome nada de `shared_json`:
// o perfil nao tem enum nem value object, so escalar e string. A dependencia de
// P-29.0 e de contrato, nao de codigo — `id` segue a mesma regra de inteiro sem
// sinal das demais entidades, e os erros de validacao sao os mesmos
// `std::invalid_argument` que o mapeamento global traduz para `400`.
//
// O formato esta documentado em docs/api.md, secao `User`.

#include <nlohmann/json.hpp>

#include "virtual_planner/domain/entities/user.hpp"

namespace virtual_planner::api::json {

// Serializa o perfil. A saida tem sempre as tres chaves, e apenas elas.
nlohmann::json to_json(const domain::User& user);

// Lanca `std::invalid_argument` quando o JSON nao e um objeto, quando falta um
// dos tres campos, quando um campo tem o tipo errado, quando o nome ou o e-mail
// nao passam na validacao de `domain::User`, ou quando o objeto traz um campo de
// credencial.
//
// Rejeitar credencial na ENTRADA, e nao apenas omiti-la na saida, e deliberado.
// Ignorar em silencio um `"password"` no corpo faria o servidor responder 200 a
// uma troca de senha que nunca aconteceu, e o cliente seguiria acreditando que a
// senha mudou. Falhar alto e a unica resposta honesta enquanto nao existir
// endpoint de troca de senha.
domain::User user_from_json(const nlohmann::json& value);

} // namespace virtual_planner::api::json
