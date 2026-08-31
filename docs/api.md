# Contrato JSON da API

Este documento define o formato JSON usado na fronteira HTTP do backend.

Ele é a **fonte de verdade do contrato REST** para quem consome a API — em
particular o frontend. O que não estiver aqui não existe na fronteira HTTP, e o
que estiver aqui foi conferido contra o código, endpoint por endpoint.

## Índice dos endpoints

Estes são **todos** os endpoints registrados hoje. A coluna "Sessão" diz se a
rota exige o cookie `vp_session`; ver [Autenticação](#autenticação).

| Método | Caminho | Sessão | Sucesso | Erros próprios |
|---|---|---|---|---|
| `OPTIONS` | qualquer caminho | não | `204` | `403` origem não autorizada |
| `GET` | `/api/health` | não | `200` | — |
| `POST` | `/api/auth/register` | não | `201` | `400`, `409` |
| `POST` | `/api/auth/login` | não | `204` | `400`, `401` |
| `POST` | `/api/auth/logout` | sim | `204` | — |
| `GET` | `/api/auth/me` | sim | `200` | `401` sessão órfã |
| `GET` | `/api/users/me` | sim | `200` | `404` perfil inexistente |
| `PATCH` | `/api/users/me` | sim | `200` | `400`, `404`, `409` |
| `GET` | `/api/goals` | sim | `200` | `400` |
| `POST` | `/api/goals` | sim | `201` | `400` |
| `GET` | `/api/goals/:id` | sim | `200` | `404` |
| `PATCH` | `/api/goals/:id` | sim | `200` | `400`, `404` |
| `PATCH` | `/api/goals/:id/status` | sim | `200` | `400`, `404` |
| `DELETE` | `/api/goals/:id` | sim | `204` | `404` |
| `GET` | `/api/tasks` | sim | `200` | `400` |
| `GET` | `/api/tasks/conflicts?date=` | sim | `200` | `400` |
| `POST` | `/api/tasks` | sim | `201` | `400` |
| `GET` | `/api/tasks/:id` | sim | `200` | `404` |
| `PATCH` | `/api/tasks/:id` | sim | `200` | `400`, `404` |
| `PATCH` | `/api/tasks/:id/status` | sim | `200` | `400`, `404` |
| `DELETE` | `/api/tasks/:id` | sim | `204` | `404` |
| `GET` | `/api/reminders` | sim | `200` | `400` |
| `POST` | `/api/reminders` | sim | `201` | `400` |
| `GET` | `/api/reminders/:id` | sim | `200` | `400`, `404` |
| `PUT` | `/api/reminders/:id` | sim | `200` | `400`, `404` |
| `DELETE` | `/api/reminders/:id` | sim | `204` | `400`, `404` |
| `GET` | `/api/reports` | sim | `200` | `400` |
| `GET` | `/api/dashboard` | sim | `200` | — |

Toda rota autenticada devolve `401` sem sessão, e toda rota pode devolver `500`
— os dois casos valem para a tabela inteira e não se repetem em cada linha.

### Um id não numérico não responde igual em toda a API

`Goal` e `Task` registram a rota como `(\d+)`: `/api/goals/abc` simplesmente
**não é uma rota registrada**, e cai no comportamento de caminho desconhecido
descrito em [Autenticação](#autenticação) — `401` sem sessão, `404` com sessão.

`Reminder` registra `([^/]*)` e valida o id no handler, então
`/api/reminders/abc` responde **400** com `code="validation_error"`.

A diferença é real e o cliente precisa saber dela. Não a esconda tratando `404`
e `400` como o mesmo caso.

## O que ainda não existe

Documentar o que não existe é tão parte do contrato quanto documentar o que
existe: sem isto o cliente descobre a ausência em tempo de execução.

Não há listagem pública de usuários, remoção de conta ou troca de senha pela
API. O perfil autenticado pode ser consultado e editado em `/api/users/me`.
Cadastro, login e logout continuam em `/api/auth/*`.

## Onde está o código

- Serialização compartilhada: `back-end/include/virtual_planner/api/json/shared_json.hpp`
  e `back-end/src/api/json/shared_json.cpp`
- Serialização de `User`: `back-end/include/virtual_planner/api/json/user_json.hpp`
  e `back-end/src/api/json/user_json.cpp`
- Servidor: `back-end/include/virtual_planner/api/http/api_server.hpp` e
  `back-end/src/api/http/api_server.cpp`
- Autenticação: `back-end/src/api/http/routes/auth_routes.cpp`
- Perfil: `back-end/src/api/http/routes/user_routes.cpp`
- Rotas de `Goal`: `back-end/src/api/http/routes/goal_routes.cpp`
- Rotas de `Task`: `back-end/src/api/http/routes/task_routes.cpp`
- Relatórios: `back-end/include/virtual_planner/api/http/routes/reporting_routes.hpp`
  e `back-end/src/api/http/routes/reporting_routes.cpp`
- Endpoints de `Reminder`: `back-end/include/virtual_planner/api/http/routes/reminder_routes.hpp`
  e `back-end/src/api/http/routes/reminder_routes.cpp`
- Mapeamento de erro: `back-end/src/api/http/error_response.cpp`
- Testes: `back-end/tests/unit/api/json/shared_json_test.cpp` e
  `back-end/tests/integration/api/api_server_test.cpp`; os endpoints de
  relatórios são cobertos por
  `back-end/tests/integration/api/reporting_routes_test.cpp`
- Testes HTTP de Reminder:
  `back-end/tests/integration/api/reminder_routes_test.cpp`

A serialização vive em `api`, não em `domain`: o domínio não conhece JSON e não
depende de `nlohmann/json`. As conversões reaproveitam `domain::to_string` e os
`*_from_string` de cada enum, então a representação textual do JSON é sempre a
mesma do domínio.

## Como habilitar

As dependências (`nlohmann/json` e `cpp-httplib`) são baixadas via
`FetchContent`. Por isso estão atrás de opções, desligadas por padrão, para que
o build sem rede continue funcionando:

```bash
# Só a serialização compartilhada.
cmake -S back-end -B back-end/build-json -DVIRTUAL_PLANNER_WITH_JSON=ON

# Serialização + servidor HTTP. Liga VIRTUAL_PLANNER_WITH_JSON junto.
cmake -S back-end -B back-end/build-http -DVIRTUAL_PLANNER_WITH_HTTP=ON

cmake --build back-end/build-http
ctest --test-dir back-end/build-http --output-on-failure
```

Sem `VIRTUAL_PLANNER_WITH_HTTP` o executável continua sendo a mesma composition
root, só que sem servidor: ele imprime a configuração e encerra.

## Servidor

O servidor escuta em `VP_HTTP_HOST` e `VP_HTTP_PORT`, documentados em
`back-end/.env.example`. Os padrões são `0.0.0.0` e `8080`. `VP_HTTP_PORT=0`
pede uma porta efêmera ao sistema operacional; a porta efetivamente aberta é
impressa na subida.

Um `VP_HTTP_PORT` que não seja um inteiro entre 0 e 65535 aborta a subida com
`shared::ConfigError` e mensagem explícita — o servidor não sobe em uma porta
que ninguém pediu.

## Limites

Valem para toda requisição, e estão em
`back-end/include/virtual_planner/api/http/api_server.hpp`:

| Limite | Valor | Motivo |
|---|---|---|
| Corpo da requisição | 1 MiB | Sem teto explícito, uma única requisição esgota a memória do processo |
| Timeout de leitura e de escrita | 10 s | Uma conexão que abre e não fala prende uma thread do pool indefinidamente |

Um corpo acima do teto é recusado pelo próprio httplib, antes de chegar ao
handler.

## Autenticação

Toda rota exige sessão, com três exceções: `GET /api/health`,
`POST /api/auth/register` e `POST /api/auth/login`. O preflight `OPTIONS`
também passa, senão o navegador nunca chegaria a mandar a requisição real.

Sem sessão válida, a resposta é **401** com `code="unauthorized"` — inclusive
para caminho que não existe. Isso é deliberado: responder `404` para rota
inexistente e `401` para rota existente deixaria qualquer anônimo mapear a
superfície da API só variando o caminho.

A sessão viaja num cookie `vp_session`, marcado `HttpOnly` para impedir sua
leitura direta pelo JavaScript e `SameSite=Strict` para restringir seu envio
entre sites. Essas medidas reduzem exposição e risco de CSRF, mas não tornam
a aplicação imune a XSS. Em `VP_PROFILE=production` o cookie ganha `Secure`
e só trafega sobre HTTPS.

Como a sessão é cookie e não cabeçalho, o CORS responde
`Access-Control-Allow-Credentials: true` e ecoa a origem em vez de devolver
`*` — com `*` o navegador recusa requisição com credencial.

### `POST /api/auth/register`

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "uma-senha-de-verdade"
}
```

Responde **201** com `{"id": 1, "email": "alice@example.com"}`. A senha exige
no mínimo 12 caracteres e é guardada como PBKDF2-SHA256 com salt por usuário e
210 000 iterações — nunca em texto claro. Registrar **não** abre sessão.

E-mail já cadastrado responde **409** com `code="conflict"`, tanto no
repositório em memória quanto no PostgreSQL. Campos inválidos respondem
**400** com `code="validation_error"`.

### `POST /api/auth/login`

```json
{
  "email": "alice@example.com",
  "password": "uma-senha-de-verdade"
}
```

Responde **204** com o cookie `vp_session` no `Set-Cookie`. Credencial errada
responde **401** com `code="invalid_credentials"` — a mesma resposta para
e-mail inexistente e para senha errada, de propósito: distinguir os dois casos
entregaria uma lista de quem tem conta.

### `POST /api/auth/logout`

Responde **204** e invalida a sessão no servidor, além de expirar o cookie.
Sem sessão válida, o gate de autenticação responde **401**.

### `GET /api/auth/me`

Quem é o dono da sessão atual. Responde **200**:

```json
{ "id": 1, "name": "Alice", "email": "alice@example.com" }
```

Existe para o frontend saber se há sessão **antes** de montar a tela. Sem ele, a
única forma de descobrir que a sessão caiu seria tomar `401` numa chamada de
domínio — com o dashboard já renderizado e vazio.

O caso de borda tem resposta própria: se a sessão apontar para um usuário que
não existe mais, o servidor encerra a sessão e responde **401** com
`code="unauthorized"`. As sessões ficam em memória e se perdem no reinício.
Com PostgreSQL habilitado, as contas e credenciais persistem: basta fazer
login novamente, sem novo cadastro.

## Escopo por dono

As rotas de `Goal`, `Task`, `Reminder`, conflitos e relatórios operam
exclusivamente sobre os dados de quem chamou. `/api/users/me` usa o mesmo
identificador da sessão, nunca um identificador fornecido no payload.

Pedir um recurso de outra pessoa responde **404**, e não 403: um 403
confirmaria ao chamador que aquele identificador existe. Vale para leitura,
atualização, mudança de status e remoção.

A verificação vive na assinatura do repositório
(`find_by_id(id, user_id)`), e não em cada handler — assim uma rota nova não
consegue esquecer de verificar, porque não compila sem o dono.

`ReminderRepository` também recebe `user_id`; as rotas passam explicitamente
o dono da sessão tanto no CRUD quanto na expansão de ocorrências. O valor
padrão legado de algumas assinaturas serve aos testes anteriores ao isolamento
e não deve ser usado como identidade em handlers HTTP.

## `GET /api/health`

Responde **sempre 200** com `Content-Type: application/json`. A resposta chegar
já é a prova de que o processo está de pé, que é o que um health check precisa
saber; o campo `status` distingue os graus de saúde.

```jsonc
{
  "app": "virtual-planner",
  "profile": "development",
  "status": "ok",
  "database": { "configured": false, "connected": false }
}
```

| Campo | Significado |
|---|---|
| `app` | `VP_APP_NAME` |
| `profile` | `VP_PROFILE` — `development`, `test` ou `production` |
| `database.configured` | `true` quando a composition root ligou um banco |
| `database.connected` | `true` quando esse banco está conectado |
| `status` | `"ok"` sem banco ou com banco conectado; `"degraded"` quando há banco configurado e ele está fora do ar |

Com PostgreSQL, `connected` verifica a conexão real com `SELECT 1`, não apenas
o estado salvo na inicialização. Uma conexão perdida produz `degraded`, sem
expor erro ou credencial do driver. A API não reconecta automaticamente: após
restabelecer o banco, reinicie a API e faça login novamente.

A aplicação sobe e responde **sem PostgreSQL**: nesse caso `configured` é
`false` e o `status` continua `"ok"`, porque não há banco para estar caído.

Rotas não registradas respondem 404.

## `GET /api/reports`

Expõe, sem recalcular na camada HTTP, o resultado do `ReportingService` da
P-23. Os dois query parameters são obrigatórios:

| Parâmetro | Valores/formato | Significado |
|---|---|---|
| `period` | `weekly`, `monthly` ou `yearly` | Período civil que contém a data-âncora |
| `date` | `YYYY-MM-DD` | Data-âncora ISO 8601 estrita |

A conversão para o intervalo inclusivo usado pelo serviço segue o contrato da
P-63:

| `period` | `start_date` | `end_date` |
|---|---|---|
| `weekly` | segunda-feira ISO da semana de `date` | domingo seguinte |
| `monthly` | primeiro dia do mês de `date` | último dia do mesmo mês |
| `yearly` | 1º de janeiro do ano de `date` | 31 de dezembro do mesmo ano |

Exemplo:

```http
GET /api/reports?period=weekly&date=2026-08-05
```

Resposta 200 com `Content-Type: application/json`:

```jsonc
{
  "start_date": "2026-08-03",
  "end_date": "2026-08-09",
  "goals_total": 2,
  "goals_completed": 1,
  "goals_partially_completed": 1,
  "goals_ratio": 0.75,
  "tasks_total": 3,
  "tasks_executed": 1,
  "tasks_partially_executed": 1,
  "tasks_ratio": 0.5,
  "most_productive_weeks": [
    { "label": "2026-W32", "total": 3, "score": 1.5, "ratio": 0.5 }
  ],
  "most_productive_months": [
    { "label": "2026-08", "total": 3, "score": 1.5, "ratio": 0.5 }
  ],
  "most_productive_shifts": [
    { "label": "Morning", "total": 2, "score": 1.5, "ratio": 0.75 }
  ],
  "task_categories": [
    { "label": "Work", "total": 3, "score": 1.5, "ratio": 0.5 }
  ],
  "goal_categories": [
    { "label": "Study", "total": 2, "score": 1.5, "ratio": 0.75 }
  ],
  "productivity_index": 0.625
}
```

Cada item das listas possui sempre `label`, `total`, `score` e `ratio`. As
fórmulas, pesos, critérios de empate e ordenação são definidos em
[`reporting-metrics-contract.md`](reporting-metrics-contract.md); a API apenas
serializa o resultado do serviço.

Em um período sem dados, as contagens são zero, as listas são vazias e
`goals_ratio`, `tasks_ratio` e `productivity_index` são `null`. `null` significa
"não há o que medir"; zero significa que havia itens no período e nenhum foi
cumprido.

Parâmetros ausentes, um `period` diferente dos três valores permitidos ou uma
data inexistente/malformada respondem 400 com `code = "validation_error"`.

## `GET /api/dashboard`

Retorna o mesmo payload completo de `GET /api/reports`, mas com `start_date` e
`end_date` iguais ao dia civil local do servidor no momento da requisição. O
endpoint não aceita parâmetros e também delega todos os cálculos ao
`ReportingService`.

Um dia sem dados é uma resposta válida 200, com a mesma semântica de zeros,
listas vazias e valores `null` descrita acima.

## Erros

Toda exceção que escape de um handler é convertida em resposta HTTP por um único
mapeamento, em `back-end/src/api/http/error_response.cpp`. Um dono de módulo
**não escreve `try`/`catch` no handler**: basta lançar o erro certo.

| Exceção | Status | `code` |
|---|---|---|
| `shared::DomainError` | 400 | `validation_error` |
| `std::invalid_argument` | 400 | `validation_error` |
| `shared::NotFoundError` | 404 | `not_found` |
| `shared::ConflictError` | 409 | `conflict` |
| qualquer outra | 500 | `internal_error` |

`std::invalid_argument` cobre `Date`, `TimeSlot`, os `*_from_string` dos enums e
os parsers de `api::json` — todos são entrada malformada do cliente.

Corpo, sempre `application/json`:

```jsonc
{ "error": { "code": "not_found", "message": "Lembrete não encontrado." } }
```

O `code` é o identificador estável: ramifique por ele, não pelo texto de
`message`.

**Nos 500 a mensagem original nunca vai na resposta.** Um `PersistenceError`
vindo do libpqxx pode carregar a connection string, e um `ConfigError` menciona
variáveis de ambiente. O cliente recebe uma mensagem genérica; o detalhe
completo vai para o log do servidor, com nível `ERROR`.

`shared::DomainError` é o erro de validação — não existe um `ValidationError`
separado. `NotFoundError` e `ConflictError` foram criados nesta issue porque não
dá para responder 404 ou 409 olhando o texto de um `std::runtime_error`: o
status precisa vir do tipo.

## CORS

Controlado por `VP_HTTP_ALLOWED_ORIGINS`, uma lista separada por vírgula. O
padrão é `http://localhost:5173`, o servidor de desenvolvimento do Vite. Um
único `*` libera qualquer origem.

- A origem permitida é **ecoada** em `Access-Control-Allow-Origin`, em vez de
  responder `*`: com `*` o navegador recusa requisição com credencial, e a
  resposta deixaria de servir no dia em que houver login.
- A resposta ganha `Vary: Origin`, senão um cache intermediário serviria a
  resposta de uma origem para outra. Ele pode aparecer ao lado do
  `Vary: Accept-Encoding` do próprio httplib — dois cabeçalhos `Vary` separados
  equivalem a uma lista única, e isso é HTTP válido.
- Uma origem não autorizada recebe a resposta normal, **sem** os cabeçalhos de
  CORS. Quem bloqueia é o navegador, e é assim que CORS funciona.
- O preflight `OPTIONS` responde 204 com os métodos e `Content-Type` permitidos,
  ou 403 quando a origem não é autorizada. Sem essa rota, um `PUT`/`DELETE` ou um
  `POST` com JSON nunca sairia do navegador.

## Log

`VP_LOG_LEVEL` aceita `debug`, `info`, `warning` ou `error`; o padrão é `info` e
um valor inválido cai no padrão em vez de impedir a subida.

Uma linha por requisição atendida:

```text
2026-08-28T16:00:00Z INFO request method=GET path=/api/health status=200
```

Só método, caminho e status. **Corpo, query e cabeçalhos ficam de fora de
propósito** — é por aí que credencial vaza para o log. Erros 500 geram uma linha
`ERROR` com o detalhe que foi suprimido da resposta.

## Regra geral

**Uma única representação por tipo em todo o projeto.** Não serialize um enum
ou um value object à mão em nenhum outro lugar: chame as funções de
`virtual_planner::api::json`. Se um formato precisar mudar, ele muda aqui e em
um só lugar.

Toda falha de desserialização lança `std::invalid_argument` — o mesmo tipo que
os `*_from_string` do domínio e os construtores de `Date` e `TimeSlot` já
lançam. O mapeamento desse erro para uma resposta HTTP está em
[Erros](#erros): `400` com `code="validation_error"`.

## Enums

Todo enum compartilhado serializa como **string JSON em PascalCase**, com
exatamente o texto de `domain::to_string`.

| Tipo | Valores |
|---|---|
| `Category` | `"College"`, `"Work"`, `"Health"`, `"Leisure"`, `"PersonalProjects"`, `"Study"` |
| `GoalPeriod` | `"Weekly"`, `"Monthly"`, `"Yearly"` |
| `GoalStatus` | `"In Progress"`, `"Completed"`, `"Partially Completed"`, `"Failed"` |
| `Priority` | `"Low"`, `"Medium"`, `"High"` |
| `ReminderRecurrence` | `"Once"`, `"Daily"`, `"Weekly"`, `"Monthly"` |
| `ReminderType` | `"Meeting"`, `"PhoneCall"`, `"Shopping"`, `"Study"`, `"Exercise"`, `"Assignment"` |
| `Shift` | `"Morning"`, `"Afternoon"`, `"Evening"` |
| `TaskStatus` | `"Pending"`, `"Executed"`, `"PartiallyExecuted"`, `"Cancelled"`, `"Postponed"` |

A comparação é **sensível a maiúsculas e minúsculas**: `"college"` é rejeitado.
Qualquer JSON que não seja string (número, `null`, objeto) também é rejeitado.

```jsonc
{ "category": "PersonalProjects", "priority": "High" }
```

Funções:

```cpp
nlohmann::json to_json(domain::Category value);
domain::Category category_from_json(const nlohmann::json& value);
// ... e o par equivalente para cada enum da tabela.
```

## `Date`

String **ISO 8601**, no formato `YYYY-MM-DD`, sempre com zero à esquerda.

```jsonc
{ "date": "2026-03-05" }
```

- O formato é estrito: `"2026-3-5"` é rejeitado, assim como qualquer sufixo de
  hora ou fuso.
- `"05/03/2026"` também é rejeitado. Esse é o formato de `Date::to_string()`,
  que existe para **exibição** e não faz parte do contrato da API.
- A data precisa existir no calendário: `"2026-02-30"` é rejeitado, e
  `"2024-02-29"` é aceito porque 2024 é bissexto.

Funções:

```cpp
nlohmann::json to_json(const domain::Date& value);
domain::Date date_from_json(const nlohmann::json& value);
```

## `TimeSlot`

Objeto com `start` e `end`, ambos **inteiros de minutos contados a partir da
meia-noite** do mesmo dia.

```jsonc
{ "time_slot": { "start": 540, "end": 600 } }   // 09:00 às 10:00
```

- Os dois campos são obrigatórios e precisam ser inteiros; `"540"` como string é
  rejeitado.
- Valem as invariantes de `TimeSlot`: `start >= 0`, `end <= 1440` e
  `end > start`. O intervalo é semiaberto `[start, end)` — ver
  [date-timeslot-contract.md](date-timeslot-contract.md).

Funções:

```cpp
nlohmann::json to_json(const domain::TimeSlot& value);
domain::TimeSlot time_slot_from_json(const nlohmann::json& value);
```

## User

A representação JSON de `User` é o perfil, e só o perfil: `id`, `name` e
`email`. É o payload que `GET /api/auth/me` já devolve.

Exemplo:

```json
{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com"
}
```

| Campo | Tipo JSON | Significado |
|---|---|---|
| `id` | inteiro sem sinal | Identificador do usuário. `0` é aceito e significa "ainda não persistido", como no corpo que `POST /api/auth/register` monta antes de o banco atribuir o id |
| `name` | string | Nome de exibição. Não pode ser vazio nem só espaço em branco |
| `email` | string | E-mail de perfil, validado por `domain::User` |

Diferente de `Goal`, `Task` e `Reminder`, `User` não consome nenhuma conversão
de P-29.0: o perfil não tem enum nem value object. A regra de `id` é a mesma das
demais entidades — inteiro sem sinal, com `1.5`, `-1` e `"42"` rejeitados.

O e-mail segue a validação de domínio, deliberadamente mínima: exatamente um
`@`, parte local não vazia e domínio com um `.` que não seja o primeiro nem o
último caractere. `alice@example` e `alice.example.com` são rejeitados;
comprimento máximo, TLD conhecido e caracteres permitidos na parte local **não**
são validados.

### Credencial nunca entra neste payload

Não há campo de senha na saída, e `domain::User` sequer guarda um: a credencial
vive apenas na tabela `users` e sai do repositório por
`find_credentials_by_email`, que devolve `persistence::UserCredentials` e nunca
passa pela camada JSON.

Na **entrada**, um objeto que traga `password`, `password_hash`, `senha` ou
`credentials` é rejeitado com `400` e `code="validation_error"`. Ignorar o campo
em silêncio faria o servidor responder sucesso a uma troca de senha que nunca
aconteceu, e o cliente seguiria acreditando que a senha mudou. Não existe
endpoint de troca de senha na API — ver "O que ainda não existe".

Funções:

```cpp
nlohmann::json to_json(const domain::User& user);
domain::User user_from_json(const nlohmann::json& value);
```

Declaradas em `back-end/include/virtual_planner/api/json/user_json.hpp`.

### `GET /api/users/me` e `PATCH /api/users/me` (P-33)

O GET retorna **200** com o perfil `{ "id": 2, "name": "Alice", "email":
"alice@example.com" }`. O PATCH aceita atualização parcial de `name` e
`email`; campos omitidos são preservados e o perfil atualizado é retornado
com **200**.

```json
{ "name": "Alice Silva" }
```

O dono vem exclusivamente da sessão. Campos extras, inclusive `id`, `user_id`,
`password` e `password_hash`, são recusados com **400**. Nome/e-mail inválidos
também retornam **400**; e-mail já usado por outra conta retorna **409**. Sem
sessão a resposta é **401**; perfil inexistente retorna **404**. Atualizar o
perfil preserva a senha: depois de alterar o e-mail, o login usa o novo e-mail
com a mesma senha. Nenhuma credencial aparece na resposta.

## Goal

A representação JSON de `Goal` reutiliza as conversões compartilhadas de
`Category`, `GoalStatus`, `GoalPeriod` e `Date` definidas em P-29.0.

Exemplo:

```json
{
  "id": 42,
  "description": "Finish C++ Planner",
  "category": "Study",
  "status": "In Progress",
  "period": "Weekly",
  "reference_date": "2026-08-28"
}
```

| Campo | Tipo JSON | Significado |
|---|---|---|
| `id` | inteiro sem sinal | Identificador da meta |
| `description` | string | Descrição da meta |
| `category` | string | `Category`, usando a representação compartilhada |
| `status` | string | `GoalStatus`, usando a representação compartilhada |
| `period` | string | `GoalPeriod`, usando a representação compartilhada |
| `reference_date` | string | Data de referência em ISO 8601 `YYYY-MM-DD` |

A serialização e a desserialização de `category`, `status`, `period` e
`reference_date` reutilizam as funções de `shared_json`; `Goal` não redefine
a representação desses tipos.

### Endpoints de Goal

Os endpoints de Goal reutilizam a representação JSON descrita acima. Erros de
validação seguem o mapeamento global da API: entrada inválida responde `400`
com `code="validation_error"` e um identificador inexistente responde `404`
com `code="not_found"`.

#### `GET /api/goals`

Lista as metas contidas no período civil indicado pelos parâmetros `period` e
`date`.

`period` aceita `weekly`, `monthly` ou `yearly`. `date` usa o formato ISO 8601
`YYYY-MM-DD` e funciona como data de referência para determinar o intervalo.

Exemplo:

```http
GET /api/goals?period=weekly&date=2026-08-05
```

Resposta **200**:

```json
[
  {
    "id": 1,
    "description": "Study C++",
    "category": "Study",
    "status": "In Progress",
    "period": "Weekly",
    "reference_date": "2026-08-05"
  }
]
```

Parâmetros ausentes, período diferente de `weekly`, `monthly` ou `yearly`, ou
uma data inválida respondem **400** com `code="validation_error"`.

#### `GET /api/goals/:id`

Retorna uma meta pelo identificador.

```http
GET /api/goals/1
```

Responde **200** com a representação JSON de `Goal`. Um identificador que não
existe responde **404** com `code="not_found"`.

#### `POST /api/goals`

Cria uma nova meta.

O cliente informa `description`, `category`, `period` e `reference_date`.
`id` é atribuído pelo repositório e `status` é definido inicialmente pelo caso
de uso de criação.

```json
{
  "description": "Read C++ book",
  "category": "Study",
  "period": "Weekly",
  "reference_date": "2026-08-15"
}
```

Responde **201** com a representação da meta criada e o cabeçalho `Location`
apontando para `/api/goals/:id`.

Campos obrigatórios ausentes, tipos incorretos, valores inválidos ou JSON
malformado respondem **400** com `code="validation_error"`.

#### `PATCH /api/goals/:id`

Atualiza parcialmente os dados de uma meta. Os campos que não aparecem no
payload preservam seus valores atuais.

Os campos aceitos são `description`, `category`, `period` e `reference_date`.
O status possui endpoint próprio.

Exemplo:

```json
{
  "description": "Study modern C++"
}
```

Responde **200** com a representação atualizada da meta. Payload inválido
responde **400** com `code="validation_error"` e um identificador inexistente
responde **404** com `code="not_found"`.

#### `PATCH /api/goals/:id/status`

Altera somente o status de uma meta.

Exemplo:

```json
{
  "status": "Completed"
}
```

Responde **200** com a representação atualizada da meta. Um status inválido ou
a ausência do campo `status` responde **400** com `code="validation_error"`.
Um identificador inexistente responde **404** com `code="not_found"`.

#### `DELETE /api/goals/:id`

Remove uma meta pelo identificador.

Uma remoção bem-sucedida responde **204** sem corpo. Um identificador
inexistente responde **404** com `code="not_found"`.

## Task

A representação JSON de `Task` reutiliza as conversões compartilhadas de
`Category`, `Date`, `TimeSlot`, `Priority` e `TaskStatus` definidas em P-29.0.

Exemplo:

```json
{
  "id": 5,
  "description": "Implementar a estrutura do AppShell",
  "category": "Work",
  "date": "2026-08-29",
  "time_slot": {
    "start": 480,
    "end": 540
  },
  "shift": "Morning",
  "scheduled_by_shift": false,
  "priority": "High",
  "status": "Pending"
}
```

| Campo | Tipo JSON | Significado |
|---|---|---|
| `id` | inteiro sem sinal | Identificador da tarefa |
| `description` | string | Descrição da tarefa |
| `category` | string | `Category`, usando a representação compartilhada |
| `date` | string | Data da tarefa, em ISO 8601 `YYYY-MM-DD` |
| `time_slot` | objeto | `TimeSlot`, com `start` e `end` em minutos desde a meia-noite |
| `shift` | string | `Shift` **derivado** de `time_slot.start`; ver abaixo |
| `scheduled_by_shift` | booleano | Indica se o intervalo representa a janela de um turno |
| `priority` | string | `Priority`, usando a representação compartilhada |
| `status` | string | `TaskStatus`, usando a representação compartilhada |

### Agendamento: intervalo e turno

`Task` aceita horário exato (`time_slot`) ou turno (`shift`). Nos dois casos,
o domínio guarda um intervalo; `scheduled_by_shift` preserva a forma escolhida.
O rótulo de saída `shift` é derivado do início do intervalo, com os limites de
`reporting::shift_of`:

| `shift` | Faixa de `time_slot.start` |
|---|---|
| `"Morning"` | `[00:00, 12:00)` — `start` em `[0, 720)` |
| `"Afternoon"` | `[12:00, 18:00)` — `start` em `[720, 1080)` |
| `"Evening"` | `[18:00, 24:00)` — `start` em `[1080, 1440)` |

Regras do formato, para não haver ambiguidade sobre qual campo manda:

- Na **saída** (`to_json`), `shift` está sempre presente e é sempre coerente com
  `time_slot`. É um rótulo de leitura; o `time_slot` é a fonte de verdade.
- No **POST/PATCH**, `time_slot` escolhe horário exato; somente `shift` escolhe
  turno. Se ambos vierem, `time_slot` prevalece e o turno deve ser coerente.
  As janelas de turno são manhã 06:00–12:00, tarde 12:00–18:00 e noite
  18:00–24:00. O cliente não define `scheduled_by_shift` nesses endpoints.
- Na desserialização da entidade (`task_from_json`), o marcador booleano
  `scheduled_by_shift` é preservado no round-trip. Quando verdadeiro junto
  com `time_slot`, exige a janela completa do turno, evitando que um intervalo
  arbitrário seja tratado como agendamento por turno.

Funções:

```cpp
nlohmann::json to_json(const domain::Task& task);
domain::Task task_from_json(const nlohmann::json& value);
```

### Endpoints de Task

Os endpoints de Task reutilizam a representação JSON acima. Erros de domínio
seguem o mapeamento único de [Erros](#erros): `400` para validação, `404` para
não encontrado, `500` genérico.

| Método e rota | Resposta |
| --- | --- |
| `GET /api/tasks` | **200** com um array de tarefas (ver filtros abaixo) |
| `GET /api/tasks/:id` | **200** com a tarefa; **404** se o id não existe |
| `POST /api/tasks` | **201** com a tarefa criada e header `Location: /api/tasks/:id` |
| `PATCH /api/tasks/:id` | **200** com a tarefa atualizada; **404** se o id não existe |
| `PATCH /api/tasks/:id/status` | **200** com a tarefa; **404** se o id não existe |
| `DELETE /api/tasks/:id` | **204** sem corpo; **404** se o id não existe |

#### `GET /api/tasks`

Lista as tarefas. Todos os filtros são passados por query string, são
**opcionais** e combinam com **E**: uma tarefa só entra na resposta se atende a
todos os filtros informados. Sem nenhum filtro, retorna todas.

| Parâmetro | Valor | Efeito |
| --- | --- | --- |
| `start_date` | `Date` ISO 8601 `YYYY-MM-DD` | mantém tarefas com `date >= start_date` |
| `end_date` | `Date` ISO 8601 `YYYY-MM-DD` | mantém tarefas com `date <= end_date` |
| `category` | `Category` | mantém tarefas dessa categoria |
| `priority` | `Priority` | mantém tarefas dessa prioridade |
| `status` | `TaskStatus` | mantém tarefas nesse status |

`start_date` e `end_date` formam um intervalo inclusivo; cada limite pode
aparecer sozinho. Se os dois vierem e `start_date > end_date`, a resposta é
**400**. Um valor que não corresponde a nenhum enum, ou uma data inexistente
(`2026-02-30`), também responde **400** com `code="validation_error"`.

#### `GET /api/tasks/conflicts?date=YYYY-MM-DD` (P-41)

Retorna **200** com os pares de tarefas em conflito no dia pedido:

```json
{ "conflicts": [{ "first_task_id": 12, "second_task_id": 19 }] }
```

Reutiliza `TaskConflictService` (P-24), sem duplicar a regra no frontend.
Considera apenas tarefas do usuário autenticado e da data pedida; ignora
canceladas/adiadas e não considera intervalos adjacentes como sobreposição.
Cada par aparece uma vez. Lembretes não fazem parte dessa regra. Ausência ou
formato inválido de `date` retorna **400**; sem sessão, **401**. Um dia sem
conflitos retorna `{ "conflicts": [] }`. A visão semanal consulta os sete dias.

#### `POST /api/tasks`

Cria uma tarefa. Corpo:

```json
{
  "description": "Implementar a estrutura do AppShell",
  "category": "Work",
  "date": "2026-08-29",
  "time_slot": { "start": 480, "end": 540 },
  "priority": "High"
}
```

Descrição, categoria, data, prioridade e um agendamento são obrigatórios.
Para agendar por turno, substitua `time_slot` por `"shift": "Morning"`,
`"Afternoon"` ou `"Evening"`. `id` é gerado pelo repositório e toda tarefa
nova nasce `"Pending"`. Um campo faltando, um valor de enum inválido, um
`time_slot` que viola as invariantes ou um JSON malformado respondem **400**.

#### `PATCH /api/tasks/:id`

Atualização parcial. Aceita qualquer subconjunto de `description`, `category`,
`date`, `time_slot`, `shift` e `priority`; os campos omitidos são preservados.
Enviar somente `shift` troca o agendamento para turno; enviar `time_slot`
troca para horário exato. `status` **não** é alterado por aqui — use
`PATCH /api/tasks/:id/status`.

#### `PATCH /api/tasks/:id/status`

Corpo `{ "status": "Executed" }`. `status` é obrigatório e aceita qualquer valor
de `TaskStatus` (`"Pending"`, `"Executed"`, `"PartiallyExecuted"`,
`"Cancelled"`, `"Postponed"`); não há máquina de estados. Um valor inválido ou
o campo ausente respondem **400**.

## Reminder

A representação JSON de `Reminder` reutiliza as conversões compartilhadas de
`Category`, `Date`, `TimeSlot`, `ReminderType` e `ReminderRecurrence` definidas
em P-29.0. Os sete campos são obrigatórios.

Exemplo:

```json
{
  "id": 42,
  "description": "Revisar paradigmas de C++",
  "category": "Study",
  "date": "2026-08-28",
  "time_slot": {
    "start": 540,
    "end": 600
  },
  "type": "Study",
  "recurrence": "Weekly"
}
```

| Campo | Tipo JSON | Significado |
|---|---|---|
| `id` | inteiro sem sinal | Identificador do lembrete |
| `description` | string | Descrição do lembrete |
| `category` | string | `Category`, usando a representação compartilhada |
| `date` | string | Data do lembrete ou data-âncora da recorrência, em ISO 8601 `YYYY-MM-DD` |
| `time_slot` | objeto | `TimeSlot`, com `start` e `end` em minutos desde a meia-noite |
| `type` | string | `ReminderType`, usando a representação compartilhada |
| `recurrence` | string | `ReminderRecurrence`, usando a representação compartilhada |

`type` e `recurrence` são sempre explícitos. Um lembrete único usa
`"recurrence": "Once"`; um lembrete recorrente usa `"Daily"`, `"Weekly"` ou
`"Monthly"`. A recorrência não é inferida de outro campo, e `date` funciona
como data-âncora da regra recorrente.

## `GET /api/reminders`

Lista as ocorrências de Reminder em uma janela inclusiva. A expansão de
recorrências é realizada por `ListRemindersUseCase`; a camada HTTP apenas
converte os parâmetros e serializa o resultado.

| Parâmetro | Obrigatório | Valores/formato |
|---|---|---|
| `start_date` | sim | data ISO 8601 `YYYY-MM-DD` |
| `end_date` | sim | data ISO 8601 `YYYY-MM-DD` |
| `type` | não | um valor de `ReminderType` |
| `recurrence` | não | `Once`, `Daily`, `Weekly` ou `Monthly` |

Os filtros opcionais usam semântica AND. A janela inclui `start_date` e
`end_date`, e uma lista sem resultados responde 200 com `[]`.

Cada item da resposta separa a data-base persistida da ocorrência expandida:

```json
[
  {
    "reminder": {
      "id": 42,
      "description": "Reunião semanal",
      "category": "Work",
      "date": "2026-08-03",
      "time_slot": { "start": 540, "end": 600 },
      "type": "Meeting",
      "recurrence": "Weekly"
    },
    "occurrence_date": "2026-08-10"
  }
]
```

`reminder.date` permanece sendo a data-base da entidade. `occurrence_date`
existe somente na resposta e não é persistido.

Parâmetros ausentes, datas inválidas, janela invertida ou enums desconhecidos
respondem 400 com `code = "validation_error"`, conforme a seção de erros.

## `GET /api/reminders/:id`

Retorna **a regra** do lembrete, e não uma ocorrência expandida — é o que a
tela de edição precisa carregar. A listagem acima expande um recorrente em
várias ocorrências dentro da janela; aqui a resposta é a entidade em si, com
`recurrence` e a `date`-âncora.

```http
GET /api/reminders/42
```

Responde **200** com a representação JSON de `Reminder`. Um identificador que
não existe responde **404** com `code = "not_found"`; um que não seja numérico
responde **400** com `code = "validation_error"`.

## `POST /api/reminders`

Cria um Reminder por meio de `CreateReminderUseCase`. O cliente envia os seis
campos editáveis, sem `id`:

```json
{
  "description": "Revisar paradigmas de C++",
  "category": "Study",
  "date": "2026-08-28",
  "time_slot": { "start": 540, "end": 600 },
  "type": "Study",
  "recurrence": "Once"
}
```

O ID é gerado pelo repositório. Um eventual `id` presente no body não controla
o identificador persistido. O sucesso responde 201 com
`Content-Type: application/json` e o Reminder completo no formato da P-29.3,
incluindo o ID gerado.

JSON malformado, body que não seja objeto, campo ausente ou valor inválido
respondem 400 com `code = "validation_error"`.

## `PUT /api/reminders/:id`

Substitui todos os seis campos editáveis por meio de
`UpdateReminderUseCase`. O body tem o mesmo formato do POST. O ID do path é a
única autoridade; um eventual `id` no body é ignorado.

O sucesso responde 200 com `Content-Type: application/json` e o Reminder
completo atualizado. ID de path inválido ou payload inválido respondem 400 com
`code = "validation_error"`. Reminder inexistente responde 404 com
`code = "not_found"`.

## `DELETE /api/reminders/:id`

Exclui o Reminder por meio de `DeleteReminderUseCase`. O sucesso responde 204
sem corpo. ID de path inválido responde 400 com `code = "validation_error"`;
Reminder inexistente responde 404 com `code = "not_found"`.

## Exemplo de uso em uma entidade

Este é o padrão que P-29.1 a P-29.4 devem seguir:

```cpp
#include "virtual_planner/api/json/shared_json.hpp"

namespace vpj = virtual_planner::api::json;

nlohmann::json body;
body["category"] = vpj::to_json(reminder.category());
body["date"] = vpj::to_json(reminder.date());
body["time_slot"] = vpj::to_json(reminder.time_slot());

const auto category = vpj::category_from_json(body.at("category"));
const auto date = vpj::date_from_json(body.at("date"));
const auto time_slot = vpj::time_slot_from_json(body.at("time_slot"));
```

## Como registrar um endpoint novo

`ApiServer` não conhece nenhum endpoint de domínio. Cada dono de módulo
registra os seus **no próprio arquivo**, a partir do `httplib::Server` e do
`RepositorySet` que o servidor expõe — assim seis pessoas nunca editam o mesmo
arquivo de rotas:

```cpp
// back-end/src/api/http/routes/goal_routes.cpp (exemplo)
void register_goal_routes(virtual_planner::api::http::ApiServer& api)
{
    auto* goals = api.repositories().goals;

    api.server().Get("/api/goals",
                     [goals](const httplib::Request&, httplib::Response& response) {
                         nlohmann::json body = nlohmann::json::array();
                         // ... serializa com virtual_planner::api::json
                         response.set_content(body.dump(), "application/json");
                     });
}
```

`main.cpp` chama os `register_*_routes` depois de construir o `ApiServer` e
antes do `bind`. Quem escolhe a implementação concreta de cada repositório
continua sendo só o `main`: a rota recebe a porta, nunca o adapter.
