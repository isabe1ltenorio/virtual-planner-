# Arquitetura De Persistência

## Objetivo

Permitir persistência real com PostgreSQL sem acoplar o núcleo da aplicação ao fornecedor de banco de dados.

## Componentes

- `persistence::Database`: controla ciclo de vida genérico de persistência.
- `persistence::Transaction`: contrato mínimo de transação.
- `persistence::*Repository`: portas de persistência para entidades de domínio.
- `infrastructure::postgres::PostgresConfig`: valida e monta configuração PostgreSQL.
- `infrastructure::postgres::PostgresDatabase`: abre, valida e encerra conexão PostgreSQL via `libpqxx`.
- `infrastructure::postgres::PostgresTransaction`: encapsula `pqxx::work` e garante rollback automático se a transação sair de escopo sem `commit()`.
- `infrastructure::postgres::PostgresGoalRepository`: persiste metas e consultas por intervalo de data no PostgreSQL.
- `infrastructure::postgres::PostgresTaskRepository`: persiste tarefas, agendamento por horário/turno e status.
- `infrastructure::postgres::PostgresUserRepository`: persiste perfis e credenciais, preservando o hash ao editar nome/e-mail.
- `infrastructure::postgres::PostgresReminderRepository`: persiste lembretes no PostgreSQL, incluindo data, horário, tipo e regra de recorrência.
- `persistence::InMemoryGoalRepository`, `InMemoryTaskRepository`, `InMemoryReminderRepository`, `InMemoryUserRepository`: implementações concretas em memória dos contratos de repositório, em `persistence/memory/`. Servem aos testes e a um modo de execução sem banco.

## Fluxo De Inicialização

1. `main` carrega configuração geral com `EnvironmentConfigLoader`.
2. Se `VP_USE_POSTGRES=true` e o binário foi compilado com `VIRTUAL_PLANNER_WITH_POSTGRES=ON`, `main` cria `PostgresConfig::from_environment()`.
3. `PostgresDatabase::connect()` chama `initialize()` quando necessário.
4. `PostgresDatabase::on_initialize()` valida a configuração.
5. `PostgresDatabase::on_connect()` abre a conexão `libpqxx` e executa `SELECT 1`.
6. `shutdown()` fecha e libera a conexão.

## Regra De Dependência

```text
domain/application
      |
      v
interfaces + persistence
      ^
      |
infrastructure/postgres
      |
      v
libpqxx
```

`libpqxx` não aparece no domínio, aplicação, core ou abstrações base de persistência.

## Transações

`PostgresTransaction` deve ser usado quando uma operação exigir atomicidade. O comportamento atual é:

- `commit()` confirma a transação.
- `rollback()` aborta explicitamente.
- O destrutor aborta automaticamente se a transação ainda estiver ativa.

## Repositórios

O projeto já possui contratos de repositório para entidades do domínio:

- `UserRepository`.
- `TaskRepository`.
- `GoalRepository`.
- `ReminderRepository`.

Esses contratos ficam em `persistence` porque são portas estáveis do núcleo. Existe uma implementação concreta de cada um em memória, em `persistence/memory/` (`InMemoryGoalRepository`, `InMemoryTaskRepository`, `InMemoryReminderRepository`, `InMemoryUserRepository`), usada pelos testes e por um modo de execução sem banco.

Os quatro contratos também possuem adapters concretos em `infrastructure/postgres`. O `PostgresReminderRepository` implementa `save` (INSERT com `RETURNING id`), `update`, `find_by_id`, `find_all` e `remove`, sempre com queries parametrizadas. A migration `040_create_reminders_table.sql` cria a tabela `reminders`, relacionada a `users` por `user_id`, e mantém as restrições dos enums de categoria, tipo e recorrência; a `041_alter_reminders_id_identity.sql` passa a geração do `id` para o banco.

Na persistência de Reminder, `recurrence` é armazenada como metadado da regra (`Once`, `Daily`, `Weekly` ou `Monthly`) ancorada em `reminder_date`. O repository preserva essa regra e o horário original; ele não materializa antecipadamente ocorrências futuras em múltiplas linhas. A expansão das ocorrências, quando necessária, permanece responsabilidade da camada de aplicação.

## Semântica de gravação

- Goal, Task e Reminder geram IDs em `save`; o ID recebido na entidade é
  ignorado. `update` altera um recurso existente do mesmo dono.
- User cadastra contas em `create(user, password_hash)`, que gera o ID. O
  fluxo de perfil consulta o usuário da sessão antes de chamar `save` para
  editar nome/e-mail sem sobrescrever credenciais. O adapter PostgreSQL usa
  UPDATE; o comportamento de seed do adapter em memória serve aos testes.
- E-mail duplicado em cadastro ou edição gera `ConflictError` nos dois
  adapters. Uma falha de unicidade PostgreSQL aborta a transação e preserva
  o perfil e a credencial anteriores.
- A ordem de `find_all()` não é um contrato de domínio. Quem depende de uma
  ordenação específica deve defini-la no caso de uso ou na apresentação.
- Goal, Task e Reminder recebem o dono em todas as consultas e mutações;
  handlers HTTP passam explicitamente a identidade da sessão.

## Limitações

- Não há pool de conexões; uma conexão libpqxx é compartilhada pela API.
- A API usa uma thread de atendimento, evitando transações concorrentes na
  mesma conexão e mutações paralelas dos repositórios em memória.
- Migrações não são executadas pelo binário: use o script ou serviço `migrate`
  do Compose, que termina antes de iniciar a API.
- Sessões não persistem no banco. Reiniciar a API exige novo login, sem perder
  a conta ou os recursos quando PostgreSQL está habilitado.

Esses limites mantêm o escopo acadêmico simples; não equivalem a uma topologia
pronta para múltiplas instâncias públicas.
