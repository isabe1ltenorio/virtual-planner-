# Contrato JSON da API

Este documento define o formato JSON usado na fronteira HTTP do backend.

Hoje ele cobre os **tipos compartilhados** — enums e value objects de domínio
(P-29.0) —, o endpoint `GET /api/health` (P-28) e os endpoints de relatórios
`GET /api/reports` e `GET /api/dashboard` (P-34). A serialização de cada
entidade (`Goal`, `Task`, `Reminder`, `User`) é definida pelas issues P-29.1 a
P-29.4 e deve, obrigatoriamente, reutilizar as regras abaixo. Os endpoints de
domínio pertencem aos donos de cada módulo. O contrato REST consolidado é
escrito na P-56.

## Onde está o código

- Serialização compartilhada: `back-end/include/virtual_planner/api/json/shared_json.hpp`
  e `back-end/src/api/json/shared_json.cpp`
- Servidor: `back-end/include/virtual_planner/api/http/api_server.hpp` e
  `back-end/src/api/http/api_server.cpp`
- Relatórios: `back-end/include/virtual_planner/api/http/routes/reporting_routes.hpp`
  e `back-end/src/api/http/routes/reporting_routes.cpp`
- Testes: `back-end/tests/unit/api/json/shared_json_test.cpp` e
  `back-end/tests/integration/api/api_server_test.cpp`; os endpoints de
  relatórios são cobertos por
  `back-end/tests/integration/api/reporting_routes_test.cpp`

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
lançam. O mapeamento desse erro para uma resposta HTTP é assunto da P-35.

## Enums

Todo enum compartilhado serializa como **string JSON em PascalCase**, com
exatamente o texto de `domain::to_string`.

| Tipo | Valores |
|---|---|
| `Category` | `"College"`, `"Work"`, `"Health"`, `"Leisure"`, `"PersonalProjects"`, `"Study"` |
| `GoalPeriod` | `"Weekly"`, `"Monthly"`, `"Yearly"` |
| `GoalStatus` | `"InProgress"`, `"Completed"`, `"PartiallyCompleted"`, `"Failed"` |
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
| `priority` | string | `Priority`, usando a representação compartilhada |
| `status` | string | `TaskStatus`, usando a representação compartilhada |

### Agendamento: intervalo e turno

`Task` tem **uma** forma de agendamento no domínio — o `time_slot`. O turno
(`shift`) não é um campo da entidade: ele é **derivado** do início do
`time_slot`, com os mesmos limites de `reporting::shift_of`:

| `shift` | Faixa de `time_slot.start` |
|---|---|
| `"Morning"` | `[00:00, 12:00)` — `start` em `[0, 720)` |
| `"Afternoon"` | `[12:00, 18:00)` — `start` em `[720, 1080)` |
| `"Evening"` | `[18:00, 24:00)` — `start` em `[1080, 1440)` |

Regras do formato, para não haver ambiguidade sobre qual campo manda:

- Na **saída** (`to_json`), `shift` está sempre presente e é sempre coerente com
  `time_slot`. É um rótulo de leitura; o `time_slot` é a fonte de verdade.
- Na **entrada** (`task_from_json`), `time_slot` é obrigatório. `shift` é
  opcional: se vier, precisa ser igual ao turno derivado de `time_slot`, senão
  o payload é rejeitado com **400**. Nunca se usa `shift` para inferir horário.

Um agendamento "por turno" — sem horário exato — depende de `Task` ter turno
nativo (lacuna A da P-62 / #34, ainda não entregue). Enquanto isso, uma tarefa
de manhã é simplesmente uma tarefa cujo `time_slot` começa antes das 12:00.

Funções:

```cpp
nlohmann::json to_json(const domain::Task& task);
domain::Task task_from_json(const nlohmann::json& value);
```

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
