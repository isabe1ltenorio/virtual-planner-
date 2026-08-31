# PostgreSQL

## Objetivo

Documentar como compilar, configurar, executar e testar a integração PostgreSQL do Virtual Planner.

## Arquitetura

PostgreSQL é suportado por adapter concreto em `infrastructure/postgres`. O núcleo permanece vendor-neutral:

- `Database` não conhece PostgreSQL.
- `Transaction` não conhece PostgreSQL.
- Os contratos de repositório de domínio não conhecem PostgreSQL.
- `PostgresDatabase` encapsula `libpqxx`.
- `PostgresTransaction` encapsula `pqxx::work`.

Goal, Task, Reminder e User possuem adapters concretos e migrations em
`back-end/migrations/`. Execute `scripts/db-migrate.sh` antes da API; o Compose
faz isso no serviço `migrate`. Contas, hashes e dados persistem no banco;
sessões ficam em memória e exigem novo login após reinício.

O endpoint `/api/health` verifica a conexão com `SELECT 1`. Queda posterior à
inicialização retorna `status: degraded` e `database.connected: false`.
Depois de restabelecer o banco, reinicie a API; não há reconexão automática.

## Dependência Escolhida

A integração usa `libpqxx` porque oferece API C++ idiomática, RAII e suporte conveniente a transações. `libpq` continua sendo alternativa possível, mas exigiria mais código manual para tratamento de recursos e erros.

## Configuração

Variáveis usadas:

- `POSTGRES_HOST`, padrão `localhost`.
- `POSTGRES_PORT`, padrão `5432`.
- `POSTGRES_DB`, obrigatório.
- `POSTGRES_USER`, obrigatório.
- `POSTGRES_PASSWORD`, obrigatório.
- `POSTGRES_SSLMODE`, padrão `disable`.
- `POSTGRES_CONNECT_TIMEOUT`, padrão `5`.
- `POSTGRES_APPLICATION_NAME`, padrão `virtual-planner`.

Para habilitar conexão na execução da aplicação:

```bash
VP_USE_POSTGRES=true
```

Use `.env.example` como referência. Não versionar `.env` real.

## Build

```bash
cmake -S back-end -B back-end/build-postgres -DVIRTUAL_PLANNER_WITH_POSTGRES=ON
cmake --build back-end/build-postgres
```

Se `libpqxx` não estiver disponível, o CMake falha com mensagem explícita.

## Docker

Subir PostgreSQL local:

```bash
docker compose up -d postgres
```

Verificar status:

```bash
docker compose ps
```

Ver logs:

```bash
docker compose logs -f postgres
```

Parar:

```bash
docker compose stop
```

Remover container sem apagar dados:

```bash
docker compose down
```

Remover container e volume local:

```bash
docker compose down -v
```

## Testes

Testes unitários de configuração rodam no build padrão:

```bash
ctest --test-dir build --output-on-failure -R postgres_config_test
```

Teste de integração PostgreSQL:

```bash
ctest --test-dir back-end/build-postgres --output-on-failure -R postgres_integration_test
```

O teste de integração valida conexão real, `commit()`, `rollback()` e `shutdown()`. Ele pula com mensagem clara quando `POSTGRES_DB`, `POSTGRES_USER` ou `POSTGRES_PASSWORD` não estão configuradas.

## Segurança

- Senhas não devem ser versionadas.
- `PostgresConfig::masked_connection_string()` mascara a senha como `***`.
- Mensagens de erro de conexão usam connection string mascarada.
- `.env` é ignorado pelo Git.
- `.env.example` contém apenas valores de exemplo.

## Troubleshooting

- Erro `VIRTUAL_PLANNER_WITH_POSTGRES=ON requires libpqxx`: instale `libpqxx` ou configure `pkg-config`.
- Erro de autenticação: confira `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`.
- Timeout de conexão: confira `POSTGRES_HOST`, `POSTGRES_PORT` e se o container está saudável.
- Aplicação diz que PostgreSQL não foi compilado: gere o build com `-DVIRTUAL_PLANNER_WITH_POSTGRES=ON`.

## Limitações

- Sem pool de conexões.
- Sem schema real.
- Sem repositórios PostgreSQL concretos para entidades de domínio.
- Sem migrations aplicadas automaticamente.
