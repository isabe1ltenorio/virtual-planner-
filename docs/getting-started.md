# Primeiros Passos

## Pré-requisitos

- Compilador com suporte a C++20.
- CMake 3.20 ou mais recente.
- `libpqxx` apenas para compilar com PostgreSQL.
- Docker opcional para subir PostgreSQL local.

## Build Padrão

```bash
cmake -S back-end -B back-end/build
cmake --build back-end/build
```

## Testes Padrão

```bash
ctest --test-dir back-end/build --output-on-failure
```

Os testes padrão cobrem configuração, persistência em memória, domínio, casos de uso e relatórios. O build com HTTP acrescenta testes JSON e chamadas reais ao servidor; o build PostgreSQL acrescenta testes de integração, que precisam de banco e variáveis de ambiente para não serem pulados.

## Execução Padrão

```bash
./back-end/build/virtual_planner
```

Variáveis de ambiente opcionais:

```bash
VP_APP_NAME=virtual-planner VP_PROFILE=development ./back-end/build/virtual_planner
```

## Build Com PostgreSQL

```bash
cmake -S back-end -B back-end/build-postgres -DVIRTUAL_PLANNER_WITH_POSTGRES=ON
cmake --build back-end/build-postgres
```

Esse build exige `libpqxx`. Se a dependência não estiver disponível, o CMake falha com mensagem clara.

## Executar Com PostgreSQL

```bash
VP_USE_POSTGRES=true ./back-end/build-postgres/virtual_planner
```

Também configure as variáveis `POSTGRES_*` descritas em `.env.example`.

## Build Com JSON Compartilhado

```bash
cmake -S back-end -B back-end/build-json -DVIRTUAL_PLANNER_WITH_JSON=ON
cmake --build back-end/build-json
ctest --test-dir back-end/build-json --output-on-failure
```

`VIRTUAL_PLANNER_WITH_JSON` é `OFF` por padrão porque baixa `nlohmann/json`
por `FetchContent`. Esse build compila a serialização compartilhada de enums e
value objects (P-29.0) e registra `shared_json_test` no CTest. O formato está
documentado em [api.md](api.md).

## Build Com HTTP

```bash
cmake -S back-end -B back-end/build-http -DVIRTUAL_PLANNER_WITH_HTTP=ON
cmake --build back-end/build-http
ctest --test-dir back-end/build-http --output-on-failure
```

`VIRTUAL_PLANNER_WITH_HTTP` é `OFF` por padrão, então o build padrão nunca toca
a rede. Esse build compila o servidor HTTP (P-28), liga
`VIRTUAL_PLANNER_WITH_JSON` junto e registra `api_server_test` no CTest.

Sem essa opção o executável continua sendo a mesma composition root, só que sem
servidor: ele imprime a configuração e encerra.

## Subir A API

```bash
VP_HTTP_HOST=127.0.0.1 VP_HTTP_PORT=8080 ./back-end/build-http/virtual_planner
```

Em outro terminal:

```bash
curl -s http://127.0.0.1:8080/api/health
```

`VP_HTTP_HOST` e `VP_HTTP_PORT` são opcionais e caem em `0.0.0.0:8080`. O
contrato da resposta está em [api.md](api.md). A API sobe e responde mesmo sem
PostgreSQL — nesse caso `/api/health` reporta que não há banco configurado.

## Docker PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

Para parar:

```bash
docker compose stop
```

Para remover o container sem apagar o volume:

```bash
docker compose down
```

Use `docker compose down -v` apenas se quiser apagar os dados locais.

## Teste De Integração PostgreSQL

Disponível apenas no build com PostgreSQL:

```bash
ctest --test-dir build-postgres --output-on-failure -R postgres_integration_test
```

O teste usa `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`. Se essas variáveis estiverem ausentes, ele é pulado com mensagem clara.

## Smoke Test Manual Com O Compilador

Se o CMake ainda não estiver instalado, um teste isolado ainda pode ser compilado diretamente com um compilador C++20:

```bash
c++ -std=c++20 -Iinclude src/core/app_config.cpp src/shared/errors.cpp tests/unit/app_config_test.cpp -o /tmp/app_config_test
/tmp/app_config_test
```
