# Virtual Planner

Virtual Planner é um projeto acadêmico desenvolvido em C++20 para ajudar no planejamento pessoal.

O domínio cobre usuários, tarefas, metas e lembretes. A API HTTP oferece autenticação por sessão, perfil, CRUD de tarefas/metas/lembretes, conflitos de agenda e relatórios. O frontend React consome a API real; PostgreSQL persiste contas e dados quando habilitado. Sem banco, os repositórios são mantidos em memória.

O build padrão continua sem rede e sem banco: HTTP, JSON, PostgreSQL e cobertura são opções desligadas por padrão.

## Objetivos

- Manter o código simples e organizado.
- Separar as principais partes do sistema.
- Compilar o projeto com CMake e C++20.
- Permitir o uso opcional do PostgreSQL.
- Criar uma base para tarefas, metas e lembretes.
- Manter testes que não dependam de um banco real.

## Tecnologias

- **C++20**: linguagem do backend.
- **CMake 3.20+**: build system, modularizado em `back-end/cmake/`.
- **CTest**: execução da suíte de testes, sem framework externo.
- **cpp-httplib** e **nlohmann/json**: servidor HTTP e serialização, baixados por `FetchContent` apenas com as flags de build ligadas.
- **React 19 + TypeScript + Vite + Tailwind CSS v4**: front-end, em `front-end/`.
- **PostgreSQL**: banco de dados, usado através de um adapter opcional.
- **libpqxx**: cliente C++ do PostgreSQL, exigido apenas quando `VIRTUAL_PLANNER_WITH_POSTGRES=ON`.
- **Docker Compose**: PostgreSQL local para desenvolvimento e testes de integração.
- **GitHub Actions**: CI do backend em `.github/workflows/backend.yml` (build padrão, JSON/HTTP, PostgreSQL e cobertura) e do front-end em `.github/workflows/frontend.yml`.

## Requisitos

- Compilador com suporte a C++20.
- CMake 3.20 ou superior.
- `libpqxx` apenas para usar PostgreSQL.
- Docker opcional.

## Compilação

### Sem PostgreSQL

Esta é a opção padrão:

```bash
cmake -S back-end -B back-end/build
cmake --build back-end/build
```

### Com a API HTTP

O servidor e a serialização JSON dependem de bibliotecas baixadas por `FetchContent`, então ficam atrás de uma opção desligada por padrão — o build padrão nunca toca a rede:

```bash
cmake -S back-end -B back-end/build-http -DVIRTUAL_PLANNER_WITH_HTTP=ON
cmake --build back-end/build-http
```

Para compilar apenas a serialização compartilhada, sem o servidor, use `-DVIRTUAL_PLANNER_WITH_JSON=ON`.

### Com PostgreSQL

É necessário instalar o `libpqxx` antes de compilar:

```bash
cmake -S back-end -B back-end/build-postgres -DVIRTUAL_PLANNER_WITH_POSTGRES=ON
cmake --build back-end/build-postgres
```

No macOS com Homebrew, o `libpq` é keg-only e fica fora do prefixo padrão que o CMake procura. Como o `libpqxx` depende dele, é preciso informar os dois prefixos:

```bash
cmake -S back-end -B back-end/build-postgres -DVIRTUAL_PLANNER_WITH_POSTGRES=ON \
  -DCMAKE_PREFIX_PATH="$(brew --prefix libpqxx);$(brew --prefix libpq)"
```

### Com cobertura de testes

```bash
cmake -S back-end -B back-end/build-coverage -DVIRTUAL_PLANNER_WITH_COVERAGE=ON
cmake --build back-end/build-coverage
ctest --test-dir back-end/build-coverage --output-on-failure
```

O job `Cobertura de testes` do CI publica o percentual no resumo da execução e o relatório HTML como artefato.

## Execução

Sem PostgreSQL:

```bash
./back-end/build/virtual_planner
```

Com PostgreSQL:

```bash
VP_USE_POSTGRES=true ./back-end/build-postgres/virtual_planner
```

No build padrão, sem a opção `VIRTUAL_PLANNER_WITH_HTTP`, o executável imprime a configuração e encerra. Com a API compilada, ele sobe o servidor:

```bash
VP_HTTP_HOST=127.0.0.1 VP_HTTP_PORT=8080 ./back-end/build-http/virtual_planner
curl -s http://127.0.0.1:8080/api/health
```

`VP_HTTP_HOST` e `VP_HTTP_PORT` são opcionais e caem em `0.0.0.0:8080` — dentro de container é o que permite ao Docker publicar a porta; fora dele, prefira `127.0.0.1`. A API sobe e responde mesmo sem PostgreSQL.

Endpoints disponíveis hoje:

| Método e rota | O que faz |
| --- | --- |
| `GET /api/health` | responde sempre 200, e informa se o banco está configurado e conectado |
| `POST /api/auth/register` | cria uma conta; senha com no mínimo 12 caracteres |
| `POST /api/auth/login` | devolve o cookie `vp_session` |
| `POST /api/auth/logout` | invalida a sessão |
| `GET /api/auth/me` | quem está logado |
| `GET/PATCH /api/users/me` | consulta e edição do próprio perfil |
| `GET /api/tasks/conflicts?date=` | pares de tarefas com sobreposição no dia |
| `GET /api/goals?period=&date=` | lista metas do período civil (`weekly`, `monthly` ou `yearly`) |
| `GET /api/goals/:id` | busca uma meta |
| `POST /api/goals` | cria uma meta |
| `PATCH /api/goals/:id` | atualização parcial |
| `PATCH /api/goals/:id/status` | altera só o status |
| `DELETE /api/goals/:id` | remove uma meta |
| `GET /api/reports?period=&date=` | métricas do período civil, mesmos valores de `period` |
| `GET /api/dashboard` | resumo do dia |

Erro de domínio vira status HTTP num mapeamento único: `400` para validação, `404` para não encontrado, `409` para conflito e `500` genérico, sem vazar a mensagem interna. O contrato completo, com CORS e log, está em [docs/api.md](docs/api.md).

Task e Reminder também oferecem CRUD completo; `/api/users/me` permite consultar e editar o perfil. `/api/tasks/conflicts?date=YYYY-MM-DD` fornece os conflitos usados pelo planejamento. Consulte o inventário completo em [docs/api.md](docs/api.md).

> **Toda rota exige sessão**, com três exceções: `GET /api/health` e as duas de
> `POST /api/auth/{register,login}`. Sem cookie válido a resposta é `401` —
> inclusive para caminho que não existe, para que ninguém mapeie a API só
> variando o caminho. Cada recurso pertence a um usuário: pedir o de outra
> pessoa responde `404`, e não `403`, porque um `403` confirmaria que aquele
> identificador existe.
>
> Ainda assim, mantenha `VP_HTTP_HOST` em `127.0.0.1` fora de container. Não
> existe HTTPS aqui, e sem ele o cookie de sessão trafega em texto claro.

## Configuração do PostgreSQL

As configurações são feitas por variáveis de ambiente:

- `POSTGRES_HOST`: padrão `localhost`.
- `POSTGRES_PORT`: padrão `5432`.
- `POSTGRES_DB`: nome do banco.
- `POSTGRES_USER`: usuário.
- `POSTGRES_PASSWORD`: senha.
- `POSTGRES_SSLMODE`: padrão `disable`.

## Variáveis De Ambiente

Existe um `.env.example` por workspace, cada um com um escopo:

| Arquivo | Alimenta | Contém |
| --- | --- | --- |
| `.env.example` (raiz) | `docker-compose.yml` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — os três valores que **criam** o banco no container |
| `back-end/.env.example` | o executável do backend e `scripts/db-migrate.sh` | `VP_*` (nome, perfil, host e porta HTTP) e `POSTGRES_*` — em qual banco **conectar** |
| `front-end/.env.example` | o build do Vite | `VITE_API_URL` — a base da API. O `.env.development`, versionado, já traz `/api` para o `npm run dev` funcionar sem passo manual |

`POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` aparecem em dois arquivos de propósito — criar o banco e conectar nele são coisas diferentes. Se mudar de um lado, mude do outro.

Copie o `.env.example` de cada workspace para `.env` no mesmo diretório e ajuste os valores. Nenhum `.env` vai para o Git: o `.gitignore` ignora `.env` e `.env.*`, com exceção explícita para `.env.example`.

Tudo com o prefixo `VITE_` é embutido no bundle e fica visível no navegador. Nunca coloque senha ou token em `front-end/.env`.

## Docker

### Stack completa

`POSTGRES_PASSWORD` é obrigatória e não tem valor padrão: sem ela o compose para
com erro em vez de subir com uma senha publicada neste repositório. De um clone
limpo:

```bash
cp .env.example .env    # e troque POSTGRES_PASSWORD
docker compose up
```

| Serviço | Porta | O que é |
| --- | --- | --- |
| `postgres` | 5432 | PostgreSQL 16 |
| `migrate` | — | roda `scripts/db-migrate.sh` uma vez e sai |
| `api` | 8080 | backend com HTTP e PostgreSQL compilados |
| `web` | 8081 | build de produção do frontend servido por nginx |

Depois de subir:

```bash
curl -s http://127.0.0.1:8080/api/health   # {"status":"ok", ...}
open http://127.0.0.1:8081                 # frontend
```

A ordem é garantida por `depends_on` com condição: a API só sobe depois que o banco está saudável **e** as migrações terminaram, e o frontend só depois que a API responde `/api/health`. O `migrate` é idempotente, então repetir `docker compose up` não reaplica nada.

O healthcheck da API confere o campo `status` da resposta, não só o código HTTP — `/api/health` responde 200 mesmo com o banco fora do ar, então checar só o status HTTP não provaria integração.

**Primeiro build demora** (alguns minutos): a imagem do backend parte do `ubuntu:24.04` e compila o `libpqxx` 8.x a partir do código-fonte, porque a distribuição empacota a 7.x e o adapter usa a API 8.x. Os builds seguintes reaproveitam a camada.

### Só o banco

Para desenvolver com o backend rodando na máquina:

```bash
docker compose up -d postgres
```

### Comandos úteis

```bash
docker compose ps
docker compose logs -f api
docker compose stop
docker compose down
```

Use `docker compose down -v` somente para apagar também os dados locais.

Todas as portas são publicadas em `127.0.0.1`, e não em `0.0.0.0`: nem o banco nem
a API ficam alcançáveis de outra máquina. Os serviços conversam entre si pela rede
interna do compose, pelo nome do serviço, então nada disso depende da publicação.

### Credenciais

Nenhuma credencial vai para dentro das imagens. Tudo entra por variável de ambiente do compose.

`POSTGRES_PASSWORD` não tem valor padrão em lugar nenhum — nem no compose, nem no `.env.example`, nem no `scripts/db-migrate.sh`. O placeholder do `.env.example` é `DEFINA-UMA-SENHA`, escolhido justamente por **não** funcionar: um placeholder que conecta é pior que nenhum, porque quem esquece de trocá-lo não descobre.

Com `VP_PROFILE=production` a aplicação recusa subir se a senha for um valor conhecido (`change-me`, `postgres`, `password`...) ou se `POSTGRES_SSLMODE` for `disable`.

## Migrações Do Banco De Dados

Com o PostgreSQL de pé (`docker compose up -d postgres`), aplique as migrações de `back-end/migrations/` com:

```bash
./scripts/db-migrate.sh
```

O script é idempotente (não reaplica migrações já registradas), roda cada migração em transação e usa as mesmas variáveis de ambiente de `back-end/.env.example` (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SSLMODE`). Veja `back-end/migrations/README.md` para detalhes.

## Tutorial: back-end e front-end juntos

Do clone até usar o aplicativo no navegador, com os dados no PostgreSQL. As
saídas e identificadores abaixo são exemplos; variam conforme os dados locais.

Há dois caminhos. O primeiro é um comando; o segundo é o do dia a dia, com
recompilação e hot reload.

### Caminho A — tudo pelo Docker

```bash
cp .env.example .env    # e troque POSTGRES_PASSWORD
docker compose up
```

Sobe banco, migrações, API e front-end na ordem certa. Quando parar de rolar
log, abra <http://127.0.0.1:8081>, crie a conta na tela de login e use.

Não há nada a configurar: o build do `web` recebe `VITE_API_URL=/api` e o nginx
faz o proxy para o serviço `api`. **O primeiro build demora alguns minutos**,
porque a imagem do backend compila o `libpqxx` a partir do código-fonte.

### Caminho B — desenvolvimento, com hot reload

Quatro terminais, ou três se o banco já estiver de pé.

**1. Banco**

```bash
cp .env.example .env    # e troque POSTGRES_PASSWORD
docker compose up -d postgres
```

**2. Migrações**

```bash
set -a && source .env && set +a
export POSTGRES_HOST=127.0.0.1
./scripts/db-migrate.sh
```

```
Concluído: N migration(ns) aplicada(s), 0 pulada(s).
```

Rodar de novo é seguro: as já aplicadas aparecem como puladas. É este passo que
cria a coluna `goals.user_id`, sem a qual nenhuma consulta funciona.

**3. Back-end**

```bash
cmake -S back-end -B back-end/build-full \
  -DVIRTUAL_PLANNER_WITH_POSTGRES=ON \
  -DVIRTUAL_PLANNER_WITH_HTTP=ON
cmake --build back-end/build-full

VP_USE_POSTGRES=true VP_HTTP_HOST=127.0.0.1 VP_HTTP_PORT=8080 \
  ./back-end/build-full/virtual_planner
```

No macOS com Homebrew, o `libpq` é keg-only e o CMake não o encontra sozinho.
Acrescente ao primeiro comando:

```bash
-DCMAKE_PREFIX_PATH="$(brew --prefix libpqxx);$(brew --prefix libpq)"
```

Confirme que a API subiu **e** enxergou o banco:

```bash
curl -s http://127.0.0.1:8080/api/health
```

```json
{"app":"virtual-planner","database":{"configured":true,"connected":true},
 "profile":"development","status":"ok"}
```

`"connected": false` significa API de pé e banco fora do alcance — confira
`POSTGRES_HOST` e se o container está rodando.

**4. Front-end**

```bash
cd front-end
npm ci
npm run dev
```

Nada a configurar: `.env.development` é versionado com `VITE_API_URL=/api`, e o
`vite.config.ts` encaminha `/api` para `http://127.0.0.1:8080`.

### Usando

Abra <http://localhost:5173>. Você cai na tela de login, porque nenhuma rota
renderiza sem sessão.

1. Clique em **Ainda não tenho conta**.
2. Preencha nome, e-mail e uma senha de **no mínimo 12 caracteres** — menos que
   isso o servidor recusa.
3. **Criar conta e entrar** leva ao dashboard.
4. Em **Metas**, crie uma meta. Ela vai para o PostgreSQL.

A prova de que atravessou tudo:

```bash
docker compose exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, user_id, description, status FROM goals ORDER BY id;"
```

```
 id | user_id | description |   status
----+---------+-------------+-------------
  1 |       1 | Estudar C++ | In Progress
```

O caminho completo é: navegador → proxy do Vite → API em C++ → `libpqxx` →
PostgreSQL. A coluna `user_id` mostra o dono; **toda consulta do adapter filtra
por ela**, então outra conta não enxerga esta linha.

### O que funciona, e o que ainda não

| Tela | Origem dos dados |
| --- | --- |
| Login, Perfil, Tarefas, Metas, Lembretes | **API e PostgreSQL** |
| Dashboard, Planejamento, Relatórios | **API**, calculados a partir dos dados do usuário |
| Configurações | Saúde real da API e do banco |

Detalhes e o que falta para fechar estão em
[Limites operacionais](#limites-operacionais).

### Erros comuns

| Sintoma | Causa |
| --- | --- |
| Cai no login e volta ao login | senha com menos de 12 caracteres; a mensagem aparece no formulário |
| Tela "A API não respondeu" | back-end fora do ar, ou em porta diferente de 8080 — ajuste com `VP_API_TARGET` |
| Retorna ao login após reiniciar a API | sessões ficam em memória; entre novamente com a conta persistida |
| `"connected": false` no health | banco fora do alcance; confira `POSTGRES_HOST` e o container |
| `relation "goals" does not exist` | faltou rodar `./scripts/db-migrate.sh` |
| `ports are not available: 5432` | já há um PostgreSQL na máquina ocupando a porta |
| Dados desaparecem após reiniciar | API iniciada sem `VP_USE_POSTGRES=true`, usando repositórios em memória |

O frontend precisa da API. `VITE_API_URL` usa `/api` por padrão; não há
modo de autenticação fictícia nem fallback automático para mocks.

## Tutorial: consumindo os dados do banco pela API

Este é o aprofundamento do anterior, **sem o front-end**: só `curl`, `psql` e o
repositório em C++. Serve para entender o contrato da API, depurar um endpoint
ou escrever código de back-end.

Se você quer o aplicativo funcionando, use o
[tutorial de back-end e front-end juntos](#tutorial-back-end-e-front-end-juntos).

As respostas abaixo ilustram o contrato; IDs e contagens dependem do banco.

### O que persiste, e o que não persiste

Antes de começar, uma ressalva que evita meia hora de confusão:

| Dado | Onde vive |
| --- | --- |
| `Goal` | PostgreSQL, tabela `goals` |
| `Reminder` | PostgreSQL, tabela `reminders` |
| `Task` | PostgreSQL, tabela `tasks` |
| `User` e credenciais | PostgreSQL, tabela `users` |
| Sessões | memória do processo; novo login após reinício |

Com `VP_USE_POSTGRES=true`, reiniciar o processo preserva contas e dados.
A sessão expira no reinício: faça login novamente, sem recriar a conta.
Sem PostgreSQL habilitado, todos os repositórios são voláteis.

### 1. Suba o banco

```bash
cp .env.example .env    # e troque POSTGRES_PASSWORD
docker compose up -d postgres
```

`POSTGRES_PASSWORD` não tem valor padrão: sem ela o compose para com erro, em
vez de subir com uma senha publicada neste repositório.

### 2. Aplique as migrações

```bash
set -a && source .env && set +a
export POSTGRES_HOST=127.0.0.1
./scripts/db-migrate.sh
```

O script é idempotente: rodar duas vezes não reaplica nada. É ele que cria a
coluna `goals.user_id`, sem a qual nenhuma consulta funciona.

### 3. Compile com PostgreSQL e HTTP

```bash
cmake -S back-end -B back-end/build-full \
  -DVIRTUAL_PLANNER_WITH_POSTGRES=ON \
  -DVIRTUAL_PLANNER_WITH_HTTP=ON
cmake --build back-end/build-full
```

No macOS com Homebrew, acrescente
`-DCMAKE_PREFIX_PATH="$(brew --prefix libpqxx);$(brew --prefix libpq)"`.

### 4. Suba a API apontando para o banco

```bash
VP_USE_POSTGRES=true VP_HTTP_HOST=127.0.0.1 VP_HTTP_PORT=8080 \
  ./back-end/build-full/virtual_planner
```

Em outro terminal, confirme que a API subiu **e** enxergou o banco:

```bash
curl -s http://127.0.0.1:8080/api/health
```

```json
{"app":"virtual-planner","database":{"configured":true,"connected":true},
 "profile":"development","status":"ok"}
```

Se vier `"connected":false`, a API está de pé mas o banco não respondeu —
confira `POSTGRES_HOST` e se o container está rodando. O `status` fica
`degraded` nesse caso.

### 5. Crie uma conta e entre

Sem sessão, tudo responde `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://127.0.0.1:8080/api/goals?period=weekly&date=2026-08-05"
```

```
401
```

> As aspas em volta da URL não são decorativas: sem elas o `zsh` tenta expandir
> o `?` como glob e o comando falha antes de sair da máquina.

Registre e faça login guardando o cookie num arquivo (`-c` grava, `-b` envia):

```bash
curl -s -X POST http://127.0.0.1:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"uma-senha-de-verdade"}'
```

```json
{"email":"alice@example.com","id":1}
```

```bash
curl -s -c cookies.txt -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"uma-senha-de-verdade"}'
```

Responde `204` e grava `vp_session` em `cookies.txt`. A senha exige no mínimo
12 caracteres; menos que isso responde `400`:

```json
{"error":{"code":"validation_error","message":"Password must contain at least 12 characters."}}
```

### 6. Grave e leia dados

Todas as chamadas a seguir usam `-b cookies.txt`.

**Criar** — responde `201`, com `Location` apontando para o recurso:

```bash
curl -s -b cookies.txt -X POST http://127.0.0.1:8080/api/goals \
  -H 'Content-Type: application/json' \
  -d '{"description":"Estudar C++","category":"Study",
       "period":"Weekly","reference_date":"2026-08-05"}'
```

```json
{"category":"Study","description":"Estudar C++","id":1,"period":"Weekly",
 "reference_date":"2026-08-05","status":"In Progress"}
```

**Listar por período** — `period` aceita `weekly`, `monthly` ou `yearly`, e
`date` é a data de referência que define o intervalo:

```bash
curl -s -b cookies.txt \
  "http://127.0.0.1:8080/api/goals?period=weekly&date=2026-08-05"
```

```json
[{"category":"Study","description":"Estudar C++","id":1,"period":"Weekly",
  "reference_date":"2026-08-05","status":"In Progress"}]
```

**Alterar o status** — endpoint próprio, separado da atualização de dados:

```bash
curl -s -b cookies.txt -X PATCH http://127.0.0.1:8080/api/goals/1/status \
  -H 'Content-Type: application/json' -d '{"status":"Completed"}'
```

**Relatório do período** — agrega só o que é seu:

```bash
curl -s -b cookies.txt \
  "http://127.0.0.1:8080/api/reports?period=weekly&date=2026-08-05"
```

```json
{"start_date":"2026-08-03","end_date":"2026-08-09","goals_total":1,
 "goals_completed":1,"goals_ratio":1.0,"productivity_index":1.0,
 "goal_categories":[{"label":"Study","ratio":1.0,"score":1.0,"total":1}], ...}
```

A meta concluída no passo anterior aparece aqui: `goals_completed` foi a 1 e a
razão fechou em `1.0`. `start_date` e `end_date` mostram que a semana ISO de
`2026-08-05` vai de segunda a domingo.

Razão com denominador zero vem como `null`, e nunca `0`. A distinção importa:
`null` é "não há o que medir", `0.0` é "havia o que medir e não foi feito".

### 7. Confira direto no banco

É aqui que se prova que o dado atravessou a aplicação e chegou ao PostgreSQL:

```bash
docker compose exec postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT id, user_id, description, status, reference_date FROM goals ORDER BY id;"
```

```
 id | user_id |  description  |  status   | reference_date
----+---------+---------------+-----------+----------------
  1 |       1 | Estudar C++   | Completed | 2026-08-05
```

A coluna `user_id` é o ponto: **toda consulta do adapter filtra por ela**. Um
`SELECT` sem esse filtro, feito à mão, enxerga as linhas de todo mundo — o
isolamento vive na aplicação, não em RLS do PostgreSQL.

### 8. O isolamento na prática

Registre um segundo usuário e repita as leituras com o cookie dele:

```bash
curl -s -X POST http://127.0.0.1:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com","password":"outra-senha-boa-123"}'
curl -s -c bob.txt -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"bob@example.com","password":"outra-senha-boa-123"}'
```

| O que Bob faz | Resposta |
| --- | --- |
| `GET /api/goals/1` (a meta da Alice) | `404` |
| `GET /api/goals?period=weekly&date=...` | `[]` |
| `GET /api/reports?...` | `goals_total: 0`, `goals_ratio: null` |

O `404` é deliberado: um `403` diria a Bob que aquele identificador existe.

### Erros comuns

| Sintoma | Causa provável |
| --- | --- |
| `401` em tudo | falta `-b cookies.txt`, ou a sessão morreu com o restart |
| `"connected":false` no health | `POSTGRES_HOST` errado, ou container fora do ar |
| `no matches found` no shell | URL com `?` sem aspas, no `zsh` |
| `400 validation_error` no registro | senha com menos de 12 caracteres |
| `relation "goals" does not exist` | faltou rodar `./scripts/db-migrate.sh` |
| Conta some após reiniciar | API estava em modo sem banco; habilite PostgreSQL para persistir |

### Consumindo pelo código, sem HTTP

Quem escreve backend não passa pela API: usa o repositório direto. O contrato
exige o dono na assinatura, então não há como esquecer de filtrar.

```cpp
#include "virtual_planner/infrastructure/postgres/postgres_goal_repository.hpp"

infrastructure::postgres::PostgresGoalRepository goals{database};

// O dono é obrigatório: sem ele isto não compila.
const auto minhas = goals.find_by_date_range(
    domain::Date{3, 8, 2026}, domain::Date{9, 8, 2026}, user_id);

const auto uma = goals.find_by_id(1, user_id);  // nullopt se for de outro dono
```

Trocar PostgreSQL por `InMemoryGoalRepository` não muda uma linha de quem chama:
ambos implementam `persistence::GoalRepository`. É o que permite a suíte de
testes rodar sem banco nenhum.

## Testes

Testes padrão:

```bash
ctest --test-dir back-end/build --output-on-failure
```

Teste de integração com PostgreSQL:

```bash
ctest --test-dir back-end/build-postgres --output-on-failure -R postgres_integration_test
```

O teste de integração precisa das variáveis `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`, e do schema aplicado via `./scripts/db-migrate.sh`.

## Estrutura do Projeto

```text
.
├── back-end
│   ├── include/virtual_planner
│   │   ├── api
│   │   │   ├── http
│   │   │   │   └── routes        # uma unidade por grupo de endpoints
│   │   │   └── json
│   │   ├── application
│   │   │   ├── goal
│   │   │   ├── reminder
│   │   │   └── reporting
│   │   ├── core
│   │   ├── domain
│   │   │   ├── entities
│   │   │   ├── enums
│   │   │   └── value_objects
│   │   ├── infrastructure
│   │   │   ├── config
│   │   │   ├── logging
│   │   │   └── postgres
│   │   ├── interfaces
│   │   ├── persistence
│   │   │   └── memory           # repositorios in-memory
│   │   └── shared
│   ├── src
│   ├── tests                    # unit/ e integration/
│   ├── cmake                    # sources/ e tests/, um arquivo por modulo
│   ├── migrations
│   ├── Dockerfile
│   ├── .env.example
│   └── CMakeLists.txt
├── front-end
│   ├── src
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── scripts
│   └── db-migrate.sh
├── docs
│   └── diagrams
├── .github/workflows
├── docker-compose.yml
└── README.md
```

## Arquitetura

O projeto está dividido em camadas:

- `domain`: entidades e regras do sistema.
- `application`: casos de uso de Goal, Task, Reminder e perfil de User; detecção de conflitos, expansão de recorrências e métricas do contrato da P-63.
- `api`: fronteira HTTP e serialização JSON. Depende das camadas internas, mas nenhuma delas depende de `api` — `httplib` e `nlohmann` só aparecem aqui.
- `interfaces`: contratos usados pelas diferentes partes do projeto.
- `persistence`: contratos para banco de dados e repositórios.
- `infrastructure`: implementações externas, como configuração e PostgreSQL.
- `core` e `shared`: configurações, erros e recursos compartilhados.
- `infrastructure/logging`: `ConsoleLogger`, adapter da porta `Logger`.
- `main.cpp`: inicia e configura a aplicação.

O código principal não depende diretamente do PostgreSQL. A implementação do banco fica em `infrastructure/postgres`.

![Diagrama da arquitetura atual do Virtual Planner](docs/diagrams/current-architecture.webp)

Outros arquivos do diagrama:

- [`docs/diagrams/current-architecture.html`](docs/diagrams/current-architecture.html)
- [`docs/diagrams/current-architecture.architecture.json`](docs/diagrams/current-architecture.architecture.json)

### Contratos De Persistência

- `persistence::Database`: abstração de ciclo de vida de persistência, independente de fornecedor.
- `persistence::Transaction`: contrato mínimo para `commit()` e `rollback()`.
- `persistence::*Repository`: contratos de repositório para as entidades de domínio. Todos têm implementação in-memory em `persistence/memory`. Goal, Task, Reminder e User possuem adapters PostgreSQL.
- `infrastructure::postgres::PostgresConfig`: configuração externa da conexão PostgreSQL.
- `infrastructure::postgres::PostgresDatabase`: adapter concreto baseado em `libpqxx`, compilado apenas com `VIRTUAL_PLANNER_WITH_POSTGRES=ON`.
- `infrastructure::postgres::PostgresTransaction`: transação PostgreSQL com rollback automático no destrutor se não houver `commit()`.
- `infrastructure::postgres::PostgresGoalRepository` e `PostgresReminderRepository`: implementações concretas sobre `libpqxx`.

## Domínio Inicial

O projeto possui as seguintes entidades:

- `User`
- `Task`
- `Goal`
- `Reminder`

Também possui tipos auxiliares para datas, horários, categorias, prioridades e status:

- Value objects: `Date` e `TimeSlot`, com contrato público congelado pela P-61.
- Enums: `Category`, `Priority`, `TaskStatus`, `GoalStatus`, `GoalPeriod`, `ReminderType`, `ReminderRecurrence` e `Shift`.

`Shift` não é campo de nenhuma entidade: o turno de uma tarefa é **derivado** de `TimeSlot::start()`, conforme decidido em [`docs/reporting-metrics-contract.md`](docs/reporting-metrics-contract.md).

## Documentação

Documentos adicionais estão disponíveis na pasta `docs/`:

- [`docs/getting-started.md`](docs/getting-started.md): primeiros passos.
- [`docs/frontend/screens.md`](docs/frontend/screens.md): inventário de telas, rotas e issues.
- [`docs/release-readiness.md`](docs/release-readiness.md): validação e limites da entrega.
- [`docs/architecture.md`](docs/architecture.md): decisões de arquitetura.
- [`docs/conventions.md`](docs/conventions.md): convenções de código, testes e build.
- [`docs/persistence-architecture.md`](docs/persistence-architecture.md): camada de persistência.
- [`docs/postgresql.md`](docs/postgresql.md): uso do PostgreSQL.
- [`docs/postgresql-integration-report.md`](docs/postgresql-integration-report.md): relatório da integração com PostgreSQL.
- [`docs/api.md`](docs/api.md): contrato JSON, endpoints, erros, CORS e log.
- [`docs/date-timeslot-contract.md`](docs/date-timeslot-contract.md): contrato público congelado de `Date` e `TimeSlot`.
- [`docs/reporting-metrics-data.md`](docs/reporting-metrics-data.md): dados necessários e casos de teste das métricas de relatório.
- [`docs/reporting-metrics-contract.md`](docs/reporting-metrics-contract.md): fórmulas e contrato das métricas de relatório.
- [`back-end/migrations/README.md`](back-end/migrations/README.md): convenção de numeração das migrações.

O planejamento e o estado das tarefas ficam nas issues do GitHub, não neste arquivo.

## 🖥️ Front-end (Interface do Usuário)

O frontend usa **React 19, TypeScript, Vite e Tailwind CSS v4**. As telas consomem endpoints reais, com sessão, tratamento de falhas e estados de carregamento/vazio.

As rotas ficam em `src/App.tsx`, dentro de um `AppShell` com sidebar e alternância de tema:

| Rota | Tela |
| --- | --- |
| `/` | dashboard |
| `/tasks`, `/tasks/new`, `/tasks/:id/edit` | tarefas |
| `/planner` | quadro semanal |
| `/goals`, `/goals/new`, `/goals/:id/edit` | metas |
| `/reminders`, `/reminders/new`, `/reminders/:id/edit` | lembretes |
| `/reports` | painel analítico |
| `/profile`, `/settings` | perfil e ajustes |
| `/login` | entrada e criação de conta, fora do `AppShell` |

### Como rodar o front-end localmente

```bash
cd front-end
npm ci
npm run dev
```

`npm ci` instala exatamente o que está em `package-lock.json` — use `npm install` só quando a intenção for alterar dependências.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento do Vite, com hot reload |
| `npm run build` | `tsc -b` seguido do build de produção do Vite |
| `npm run lint` | ESLint sobre todo o workspace |
| `npm test` | Vitest e Testing Library, sem modo watch |
| `npm run format:check` | Confere formatação com Prettier |
| `npm run preview` | Serve localmente o resultado de `npm run build` |

### Integração contínua

`.github/workflows/frontend.yml` roda em Node 22 a cada push em `main` e pull request de frontend: instalação pelo lockfile, build, lint, testes e verificação de formatação. Execute esses mesmos checks localmente.

### Front-end ligado à API

**Já vem configurado.** Não há passo manual: `front-end/.env.development` é
versionado com `VITE_API_URL=/api`, o `vite.config.ts` faz proxy de `/api` para
`http://127.0.0.1:8080`, e o `docker compose` passa a mesma coisa para o build
do `web`, com o nginx fazendo o proxy.

Com o backend de pé, basta:

```bash
cd front-end
npm ci
npm run dev
```

A tela de login aparece, você cria a conta ali mesmo e cai no dashboard. As
telas de **metas, tarefas, lembretes e perfil** leem e gravam no backend.
A API é necessária mesmo quando `VITE_API_URL` não é definida: o padrão é `/api`.

#### Por que o caminho é relativo, e não a URL do backend

O cookie de sessão é `SameSite=Strict`: o navegador só o envia em requisição do
mesmo site. Apontando `VITE_API_URL` para `http://127.0.0.1:8080` a partir de
`localhost:5173`, o login responde `204` e **todas** as chamadas seguintes
voltam `401`, porque o cookie fica para trás. O proxy elimina isso ao deixar
front e backend na mesma origem. Para mudar o alvo do proxy, use
`VP_API_TARGET`.

#### Como está montado

```text
front-end/src
├── lib/api
│   ├── config.ts             # lê VITE_API_URL, com padrão /api
│   ├── httpClient.ts         # fetch com credentials; erro da API vira ApiError
│   ├── goalsApi.ts           # endpoints de Goal
│   ├── authApi.ts            # register, login, logout
│   ├── session.ts            # quem está logado, via GET /api/auth/me
│   └── virtualPlannerApi.ts  # fachada tipada para os endpoints reais
├── components/RequireSession.tsx   # guarda: sem sessão, manda para /login
└── pages/LoginPage.tsx             # login e criação de conta
```

Não há token em `localStorage` de propósito: a sessão é um cookie `HttpOnly`
que o JavaScript não lê. Isso reduz a exposição do cookie, mas não elimina
os demais impactos de XSS; a publicação exige HTTPS e cuidados de segurança.

### Limites operacionais

- Sessões vivem em memória e exigem novo login após reiniciar a API.
- Sem PostgreSQL, contas e dados são voláteis.
- O Compose serve HTTP em loopback para uso local. Publicação na internet
  exige HTTPS, configuração de produção e credenciais próprias; não exponha
  as portas diretamente.
- Notificações de lembretes dependem da permissão do navegador e da aba aberta.
- A validação de release e os critérios de aceite estão em
  [docs/release-readiness.md](docs/release-readiness.md). Aprovações nominais
  de colaboradores não são substituídas por testes automatizados.

### Estrutura

```text
front-end/src
├── components   # componentes reutilizáveis de UI
├── pages        # telas, uma por rota
├── lib          # helpers sem JSX
├── mocks        # exemplos legados, fora do fluxo principal
├── types        # tipos compartilhados entre telas
└── assets       # imagens e estáticos
```

As convenções de front-end estão em [AGENTS.md](AGENTS.md#agent-especialista-frontend--react--typescript) e em [front-end/README.md](front-end/README.md).
