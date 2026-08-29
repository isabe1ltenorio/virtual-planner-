# Arquitetura

## Objetivo

Este projeto é um monorepo acadêmico com dois workspaces: `back-end/`, uma base modular em C++20 com CMake, e `front-end/`, uma aplicação React + TypeScript com Vite. Este documento descreve o backend; as convenções de frontend estão em [AGENTS.md](../AGENTS.md).

O código atual define estrutura, contratos, configuração, ciclo de vida de persistência, adapters PostgreSQL de `Goal` e `Reminder`, uma camada de API HTTP com serialização JSON compartilhada, casos de uso de `Goal` e `Reminder`, e a modelagem de domínio completa de planejamento pessoal.

A arquitetura deve continuar pragmática: manter limites claros, mas evitar frameworks, padrões ou infraestrutura além do que o trabalho realmente precisa.

## Camadas

- `core`: primitivas usadas por toda a aplicação, como perfil de execução e configuração imutável de inicialização.
- `domain`: entidades, value objects, enums e regras básicas de domínio. Não deve depender de infraestrutura nem de detalhes de persistência.
- `application`: casos de uso que coordenam o domínio por meio de contratos. Hoje cobre `Goal` (criar, listar, atualizar, mudar status, excluir) e `Reminder` (criar, listar com expansão de recorrência, atualizar, excluir). `Task` e `User` ainda não têm casos de uso.
- `interfaces`: portas estáveis usadas pelas camadas internas para evitar acoplamento com tecnologias concretas — hoje `ConfigProvider` e `Logger`.
- `persistence`: abstrações do ciclo de vida de armazenamento, transação e contratos de repositório, com implementações em memória em `persistence/memory`. Não deve conhecer PostgreSQL.
- `api`: camada de fronteira HTTP. `api/json` é a **única** serialização de enums e value objects do projeto; `api/http` tem o servidor, a configuração de rede e o mapeamento de erro de domínio para status. É a única camada onde `httplib` e `nlohmann/json` podem aparecer.
- `infrastructure`: adaptadores para variáveis de ambiente, PostgreSQL e log.
- `shared`: primitivas transversais que não pertencem a uma camada específica, como as exceções base.

## Regra de Dependência

As dependências devem apontar para dentro, na direção das políticas mais estáveis:

- `domain` não deve incluir `infrastructure`.
- `application` pode depender de `domain`, `core` e interfaces estáveis, mas não de adaptadores concretos de infraestrutura.
- `core` não deve incluir cabeçalhos de bancos de dados ou drivers concretos.
- `persistence::Database` e `persistence::Transaction` não devem incluir headers de PostgreSQL.
- `interfaces` deve permanecer pequena e estável.
- `infrastructure` pode depender de `core`, `interfaces`, `persistence` e `shared` para adaptar detalhes externos.
- `api` pode depender de `core`, `domain`, `application`, `persistence`, `interfaces` e `shared`. **Nenhuma delas pode depender de `api`**: a serialização e o protocolo são detalhes de fronteira, e o domínio não sabe que existe HTTP.
- `httplib` e `nlohmann/json` só podem aparecer sob `api`. Nenhum header de HTTP ou JSON entra em `domain`, `application`, `core`, `interfaces` ou nos contratos base de `persistence`.
- `main` é a raiz de composição, onde as implementações concretas são conectadas. É o único lugar que escolhe entre repositório em memória e PostgreSQL.

## Diagrama De Dependências

```text
front-end (React)
      |  REST/JSON
      v
api/http + api/json  ......  httplib + nlohmann (só aqui)
      |
      v
application (casos de uso)
      |
      v
domain  +  interfaces + persistence abstractions
                        ^
                        |
              infrastructure/postgres
                        |
                        v
                  libpqxx/libpq
```

O diagrama visual fica em `docs/diagrams/current-architecture.webp`, gerado por
Archify a partir de `docs/diagrams/current-architecture.architecture.json`. O
JSON é a fonte de verdade: edite-o e regenere, nunca edite o HTML à mão.

## Persistência

`virtual_planner::persistence::Database` gerencia apenas estado de ciclo de vida: inicialização, conexão, encerramento e transições de falha. Ela intencionalmente não conhece nenhuma regra de produto nem fornecedor de banco de dados.

`virtual_planner::persistence::Transaction` define o contrato mínimo para `commit()` e `rollback()`.

Os contratos `UserRepository`, `TaskRepository`, `GoalRepository` e `ReminderRepository` definem portas de persistência para entidades do domínio. Eles não representam persistência concreta e não devem conter detalhes de PostgreSQL.

`virtual_planner::infrastructure::postgres::PostgresDatabase` é o adapter concreto para PostgreSQL. Ele herda de `Database`, usa `PostgresConfig`, encapsula a conexão `libpqxx` e só é compilado quando `VIRTUAL_PLANNER_WITH_POSTGRES=ON`.

`virtual_planner::infrastructure::postgres::PostgresTransaction` encapsula `pqxx::work`, faz `commit()`, `rollback()` e aborta automaticamente no destrutor se a transação ainda estiver ativa.

## Domínio

A primeira modelagem de domínio cobre os conceitos principais do Virtual Planner:

- `User`: usuário do sistema.
- `Task`: tarefa planejada com data, horário, prioridade e status.
- `Goal`: meta com categoria, período e status.
- `Reminder`: lembrete com data, horário, tipo e recorrência.
- `Date`: value object para datas válidas.
- `TimeSlot`: value object para intervalos de horário e detecção de sobreposição.

Essa camada ainda não deve conhecer banco de dados, variáveis de ambiente, interface de usuário ou PostgreSQL.

## Configuração

O adaptador `EnvironmentConfigLoader` lê:

- `VP_APP_NAME`, com valor padrão `virtual-planner`.
- `VP_PROFILE`, com valor padrão `development`.

O adapter PostgreSQL lê:

- `POSTGRES_HOST`, com valor padrão `localhost`.
- `POSTGRES_PORT`, com valor padrão `5432`.
- `POSTGRES_DB`, obrigatório.
- `POSTGRES_USER`, obrigatório.
- `POSTGRES_PASSWORD`, obrigatório.
- `POSTGRES_SSLMODE`, com valor padrão `disable`.
- `POSTGRES_CONNECT_TIMEOUT`, com valor padrão `5`.
- `POSTGRES_APPLICATION_NAME`, com valor padrão `virtual-planner`.

## Dependências Externas

O build padrão não exige dependências externas de runtime ou de teste. A integração PostgreSQL usa `libpqxx` apenas quando `VIRTUAL_PLANNER_WITH_POSTGRES=ON`.

Adicione novas bibliotecas externas apenas quando houver uma necessidade concreta e o tradeoff estiver documentado. Para o escopo acadêmico atual, prefira a STL e pequenas abstrações locais.

## Decisões Registradas

### ADR-001 — Destino das portas em `interfaces` (P-13)

**Contexto.** `interfaces/` continha cinco portas sem nenhum consumidor no
código: `cache.hpp`, `event_bus.hpp`, `logger.hpp`, `repository.hpp` e
`serializer.hpp`. Apenas `config_provider.hpp` era realmente incluído (por
`infrastructure/config/environment_config_loader.hpp`). Abstrações
especulativas contrariam a regra do projeto de não criar infraestrutura além do
necessário e aumentam o custo de manutenção sem benefício.

**Decisão.** Manter em `interfaces/` somente portas com consumidor real no
código hoje. Uma porta apenas prevista por issue futura não permanece no
repositório: ela é reintroduzida junto do primeiro consumidor real.

| Porta | Destino | Justificativa |
| --- | --- | --- |
| `config_provider.hpp` | mantida | Consumida por `infrastructure/config/environment_config_loader.hpp`. |
| `logger.hpp` | removida | Sem consumidor no código e não registrada em nenhum alvo CMake. P-54 condiciona a porta a esta ADR ("implementação concreta da porta `Logger`, se mantida em P-13"), de modo que mantê-la aqui seria um adiamento circular. P-54 a reintroduz junto do seu primeiro consumidor real. |
| `cache.hpp` | removida | Sem consumidor e sem issue no backlog que exija cache. |
| `event_bus.hpp` | removida | Sem consumidor e sem requisito de mensageria no escopo. |
| `serializer.hpp` | removida | P-29.0 define a serialização JSON com funções livres sobre `to_string`/`from_string`, não com uma porta genérica. |
| `repository.hpp` | removida | Os contratos de persistência reais são os de `persistence/*_repository.hpp`, que não derivam do template genérico; P-25 implementa aqueles contratos. |

**Consequências.** Se uma dessas portas voltar a ser necessária, ela deve ser
reintroduzida junto do primeiro consumidor real, no mesmo PR, nunca antes.

### ADR-002 — Modelo de usuário: usuário único com `user_id` explícito (P-22A)

**Contexto.** O domínio tem a entidade `User`, mas nenhuma tabela tem `user_id`
e não existe nenhum requisito de autenticação no backlog. Ao mesmo tempo, quatro
pessoas vão escrever migrations de `Goal`, `Task`, `Reminder` e `User` na Onda 3.
Se `user_id` entrar depois, as quatro precisam refazer schema e backfill.

**Decisão.** O sistema é **single-tenant**: existe exatamente um usuário, sem
cadastro, login, senha ou sessão. Ainda assim, as tabelas de dados do usuário
nascem com `user_id` explícito, apontando para esse usuário único semeado pela
migration base.

**Impacto por entidade.**

| Entidade | Impacto |
| --- | --- |
| `User` | Tabela `users` criada na faixa base, com uma linha semeada de `id = 1`. Sem coluna de senha e sem coluna de credencial. `email` continua sendo apenas dado de perfil. |
| `Goal` | A migration de Goal (P-26.1) adiciona `user_id BIGINT NOT NULL REFERENCES users(id)`. A tabela `goals` atual, criada em `001`, não é reescrita: a coluna entra por migration nova, na faixa de Goal. |
| `Task` | Migration de Task (P-26.2) já nasce com `user_id BIGINT NOT NULL REFERENCES users(id)`. |
| `Reminder` | Migration de Reminder (P-26.3) já nasce com `user_id BIGINT NOT NULL REFERENCES users(id)`. |

**Impacto em endpoints e autenticação.**

- Não há autenticação, nem middleware de sessão, nem token.
- O usuário corrente é resolvido no composition root como o usuário único e
  injetado nos casos de uso; nenhum endpoint recebe `user_id` pelo cliente.
- `GET /api/users/me` (P-33) devolve esse usuário único.
- Endpoints de `Goal`, `Task` e `Reminder` não expõem `user_id` no payload nesta
  fase; o filtro por usuário é aplicado no servidor.

**Alternativa rejeitada.** Multiusuário com autenticação real: exigiria senha,
hash, sessão/token e telas de cadastro, tudo fora do escopo acadêmico do
projeto e sem issue no backlog que o cubra.

**Alternativa rejeitada.** Single-tenant sem `user_id` nenhum: mais simples
agora, mas transformaria qualquer evolução para multiusuário em reescrita de
schema e backfill nas quatro tabelas — exatamente o risco que esta decisão
existe para eliminar.

**Consequências.** Nenhuma issue de Onda 3 fica bloqueada esperando decisão de
identidade; a porta para multiusuário fica aberta ao custo de uma coluna e uma
foreign key por tabela.

### ADR-003 — Biblioteca HTTP e JSON do backend (P-27)

- **Status:** Aceita
- **Data:** 2026-08-19
- **Issue:** #13 (P-27)

**Contexto.** O backend precisa expor uma API REST para o frontend (Onda 4) e
para o servidor HTTP da Onda 2 (#29 / P-28). A escolha condiciona o contrato
JSON compartilhado (#30 / P-29.0) e todos os endpoints, então precisa ser feita
uma única vez e cedo. O projeto compila com CMake puro e não adota gerenciador
de pacotes externo, então a única forma admissível de trazer a dependência é
`FetchContent`.

**Opções consideradas.** As três foram efetivamente configuradas e compiladas
nesta máquina (macOS 15 arm64, AppleClang 21, CMake 4.4.0), com um PoC
equivalente de `/api/health` em cada uma. Os números abaixo são medidos, não
estimados.

| Opção | Licença | Header-only | `FetchContent` sem instalação manual | Build limpo do PoC | Fontes baixadas |
| --- | --- | --- | --- | --- | --- |
| **cpp-httplib 0.53.1 + nlohmann/json 3.12.0** | MIT / MIT | sim / sim — nenhuma biblioteca é gerada, os alvos são `INTERFACE` | **sim**, sem nenhum ajuste | **4,9 s** de configure (com download) + **2,6 s** de compilação | **17 MB** |
| Crow 1.3.3 + nlohmann/json 3.12.0 | BSD-3-Clause / MIT | sim, mas arrasta o Asio standalone (BSL-1.0): 417 cabeçalhos do Asio entram na unidade de tradução do PoC | **não** — falha no configure com `Could NOT find asio (missing: ASIO_INCLUDE_DIR)`. Só compila com um `FetchContent` extra do Asio e `ASIO_INCLUDE_DIR` apontado à mão | 27,3 s de configure + 1,9 s de compilação, já com o contorno | 44 MB |
| Boost.Beast + Boost.JSON (Boost 1.89.0) | BSL-1.0 / BSL-1.0 | Beast sim; **Boost.JSON não** — o build gera `libboost_json.a`. O modo header-only é opt-in via `boost/json/src.hpp` | parcialmente — `find_package(Boost COMPONENTS json)` falha (`missing: Boost_INCLUDE_DIR json`), porque não há Boost instalado. Funciona só pelo tarball oficial `boost-1.89.0-cmake.tar.xz`, de 97,4 MiB | 17,5 s de configure + 4,5 s de build, que compila `boost_json`, `boost_container` e `boost_date_time` | diretório de build de **784 MB** |

**Decisão.** Adotar **cpp-httplib + nlohmann/json**, integradas por
`FetchContent` em `back-end/cmake/http.cmake`, atrás da opção de CMake
`VIRTUAL_PLANNER_WITH_HTTP`, desligada por padrão.

**Motivo.** Ancorado na tabela, e nesta ordem de peso:

1. **É a única que `FetchContent` resolve sozinha.** Crow não é auto-suficiente:
   falha no configure procurando `ASIO_INCLUDE_DIR`. Boost precisa do tarball de
   97,4 MiB porque não há Boost instalado no ambiente. A `#13` exige que o PoC
   compile "sem instalação manual de dependência", e só esta opção cumpre isso
   sem contorno.
2. **É a única MIT nas duas metades.** Crow é BSD-3-Clause e ainda adiciona a
   BSL-1.0 do Asio, ou seja, três licenças. Boost adiciona a BSL-1.0. Nenhuma
   das duas é restritiva, mas para um trabalho acadêmico uma licença única e
   permissiva é menos coisa para justificar.
3. **É header-only de verdade.** Nenhum artefato de biblioteca é gerado. Boost.JSON
   gera `libboost_json.a`, o que significa build de biblioteca e não apenas de
   cabeçalhos — exatamente o custo que a `#13` quis evitar.
4. **Custo de disco e de build é o menor.** 17 MB de fontes contra 44 MB do
   Crow + Asio e um diretório de build de 784 MB no Boost. O ciclo completo de
   configure + build limpo fica em cerca de 7,5 s.

**Registro honesto do que contraria a decisão.** No PoC trivial, o Crow
compilou um pouco mais rápido que o cpp-httplib (1,9 s contra 2,6 s), porque o
`httplib.h` é um cabeçalho único e grande. A diferença é de menos de um segundo
e não compensa a dependência transitiva do Asio nem a falha de `FetchContent`.

**Correção da premissa inicial.** O levantamento de partida da `#13` supunha que
Crow resolveria por `FetchContent` e que Boost exigiria instalação prévia. A
medição mostrou o oposto em ambos os casos: quem falha no `FetchContent` puro é
o Crow, e o Boost é obtível por `FetchContent` — só que a um custo de disco duas
ordens de grandeza maior. A decisão não muda, mas o motivo é outro.

**Consequências.**

- O contrato JSON de #30 (P-29.0) é escrito contra a API do `nlohmann::json`.
- As dependências entram por `FetchContent`, cada uma atrás da sua opção,
  ambas `OFF` por padrão — com as duas desligadas nenhum `FetchContent_Declare`
  é avaliado e o build sem rede continua verde:
  - `nlohmann/json` em `back-end/cmake/json.cmake`, pela opção
    `VIRTUAL_PLANNER_WITH_JSON`;
  - `cpp-httplib` em `back-end/cmake/http.cmake`, pela opção
    `VIRTUAL_PLANNER_WITH_HTTP`, que liga `VIRTUAL_PLANNER_WITH_JSON` junto.

  A separação veio na P-29.0: a serialização compartilhada e as serializações
  de entidade (P-29.1 a P-29.4) precisam de JSON, mas não do servidor HTTP.
- `nlohmann/json` é baixado pelo tarball da release (112 KiB, verificado por
  `SHA256`) e não pelo clone git, que ocupa 195 MB por trazer testes e dados de
  benchmark.
- O PoC `back-end/src/api/health_poc.cpp` existiu apenas como prova da decisão e
  foi removido na P-28, substituído pelo servidor real em
  `back-end/src/api/http/`. Diferente do PoC, esse servidor é coberto por
  `api_server_test` no CTest e roda no CI.
- Trocar de biblioteca depois custa reescrever a camada `src/api/`, não o
  domínio.

**Alternativa rejeitada.** Boost.Beast + Boost.JSON. Além do custo de disco, o
Beast é uma API de baixo nível: não tem roteamento, então `/api/health` exigiria
escrever à mão o parsing de método e caminho. Para o escopo desta issue isso é
infraestrutura muito além do necessário.

**Alternativa rejeitada.** Crow + nlohmann/json. A API de roteamento é
agradável, mas exige fixar a dependência do Asio no `CMakeLists` do projeto, o
que transfere para nós a manutenção de uma dependência que a própria biblioteca
deveria resolver.

### ADR-004 — Conflito de horário entre tarefas: alertar, não bloquear (P-24)

- **Status:** Aceita
- **Data:** 2026-08-29
- **Issue:** P-24

**Contexto.** `TimeSlot::overlaps` já existe e tem a semântica de adjacência
travada por teste (`time_slot_test`), mas nada no backend a consome. O planner
precisa avisar quando duas tarefas do mesmo dia colidem no horário. A issue pede
uma decisão explícita: **bloquear a criação** de uma tarefa que se sobrepõe a
outra, ou apenas **alertar**.

**Decisão.** O backend apenas **alerta**. `application::TaskConflictService`
(em `application/task/`) recebe uma data e devolve os pares de tarefas cujo
`TimeSlot` se sobrepõe. `CreateTaskUseCase` e `UpdateTaskUseCase` não mudam:
criar ou editar uma tarefa nunca falha por conflito de horário.

**Motivo.**

1. A entidade `Task` não tem máquina de estados e o domínio permite sobreposição
   de propósito — duas atividades podem ocupar o mesmo intervalo (algo em
   segundo plano, um compromisso opcional).
2. Bloquear exigiria alterar `CreateTaskUseCase` (já entregue em P-20) e definir
   uma UX de resolução de conflito, que pertence à visualização do planner
   (P-41). Um serviço de consulta puro é componível: P-41 chama e decide como
   apresentar.
3. A própria motivação da issue diz "avisar quando duas atividades colidem".

**Regras do serviço.**

- Compara apenas tarefas cuja data é igual à data pedida.
- Ignora tarefas `Cancelled` e `Postponed`: não ocupam o horário, então alertar
  sobre elas seria ruído.
- Usa `TimeSlot::overlaps` diretamente. Adjacência (fim de uma igual ao início
  da outra) **não** é conflito.
- Cada par conflitante aparece uma única vez, na ordem do repositório.

**Fora do escopo.** Conflito tarefa↔lembrete: o contrato `TaskRepository` não
conhece lembretes e os arquivos de `Reminder` estão fora desta issue. Fica para
quando houver um consumidor real que precise dos dois.

**Alternativa rejeitada.** Bloquear a criação. Transferiria para o backend uma
regra de produto ainda não decidida (o que fazer com o conflito: impedir,
sugerir novo horário, permitir com aviso) e acoplaria P-20 a P-41.

## Limitações Atuais

- Não há pool de conexões.
- Não há services de aplicação completos.
- Não há repositórios concretos PostgreSQL para entidades de domínio.
- Não há schema SQL real.
- Não há migrations aplicáveis porque ainda não há mapeamento persistente definido.
- O build com PostgreSQL depende de `libpqxx` disponível no ambiente.

### ADR-002 — Modelo de usuário: usuário único com `user_id` explícito (P-22A)

**Contexto.** O domínio tem a entidade `User`, mas nenhuma tabela tem `user_id` e não existe nenhum requisito de autenticação no backlog. Ao mesmo tempo, quatro pessoas vão escrever migrations de `Goal`, `Task`, `Reminder` e `User` na Onda 3. Se `user_id` entrar depois, as quatro precisam refazer schema e backfill.

**Decisão.** O sistema é **single-tenant**: existe exatamente um usuário, sem cadastro, login, senha ou sessão. Ainda assim, as tabelas de dados do usuário nascem com `user_id` explícito, apontando para esse usuário único semeado pela migration base.

**Impacto por entidade.**

*   **User:** Tabela `users` criada na faixa base, com uma linha semeada de `id = 1`. Sem coluna de senha e sem coluna de credencial. `email` continua sendo apenas dado de perfil.
*   **Goal:** A migration de Goal adiciona `user_id BIGINT NOT NULL REFERENCES users(id)`.
*   **Task:** Migration de Task já nasce com `user_id BIGINT NOT NULL REFERENCES users(id)`.
*   **Reminder:** Migration de Reminder já nasce com `user_id BIGINT NOT NULL REFERENCES users(id)`.

**Impacto em endpoints e autenticação.**

*   Não há autenticação, nem middleware de sessão, nem token.
*   O usuário corrente é resolvido no composition root como o usuário único e injetado nos casos de uso; nenhum endpoint recebe `user_id` pelo cliente.
*   Endpoints de `Goal`, `Task` e `Reminder` não expõem `user_id` no payload nesta fase; o filtro por usuário é aplicado no servidor.