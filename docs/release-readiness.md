# Preparação de release — 31/08/2026

Esta entrega reúne as issues abertas do produto. Não cria tag nem publica uma
release automaticamente. O Compose é a forma de executar a aplicação completa
localmente; veja o [tutorial do README](../README.md#tutorial-back-end-e-front-end-juntos).

## Escopo por issue

| Plano / issue | Entrega técnica |
|---|---|
| P-7.1 / #78 | [Inventário de telas e rotas](frontend/screens.md), navegação, estados e donos |
| P-64 / #39 | Componentes visuais reutilizáveis e sem dependência de domínio/rede |
| P-26.4 / #44 | Persistência de User, credenciais preservadas e conflitos de e-mail testados no PostgreSQL |
| P-29.4 / #52 | JSON de User sem credenciais, com round-trip e validação de entrada |
| P-33 / #53 | GET/PATCH do próprio perfil, identidade pela sessão e testes HTTP |
| P-38 / #55 | Cliente tipado, cookies, proxy, saúde real e ausência de sessão fictícia |
| P-39 / #56 | CRUD de metas e consulta por período/data, com edição por ID |
| P-40 / #57 | CRUD de tarefas, filtros combinados e agendamento por intervalo/turno |
| P-41 / #59 | Planejamento dia/semana com ocorrências e conflitos calculados pelo backend |
| P-42 / #58 | CRUD de lembretes, recorrências e filtros de ocorrências |
| P-43 / #60 | Dashboard e relatórios calculados pela API, com tratamento de indicadores sem dados |
| P-44 / #61 | Paleta de categorias compartilhada e texto legível nos badges |
| P-45 / #62 | Perfil editável e configurações com status da API e conexão real do banco |
| P-46 / #63 | Carregamento, erro, nova tentativa e estados vazios reutilizados |
| P-47 / #64 | ESLint/Prettier, `format:check` e formatação em commit separado |
| P-48 / #65 | Vitest/Testing Library, cliente HTTP e componentes/formulários com estado |

## Validação reproduzível

Na raiz do repositório:

```bash
cmake -S back-end -B back-end/build-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build back-end/build-debug
ctest --test-dir back-end/build-debug --output-on-failure

cmake -S back-end -B back-end/build-release -DCMAKE_BUILD_TYPE=Release
cmake --build back-end/build-release
ctest --test-dir back-end/build-release --output-on-failure

cmake -S back-end -B back-end/build-full -DCMAKE_BUILD_TYPE=Release \
  -DVIRTUAL_PLANNER_WITH_HTTP=ON -DVIRTUAL_PLANNER_WITH_POSTGRES=ON
cmake --build back-end/build-full
# Exporte POSTGRES_* de um banco descartável e aplique as migrations antes:
./scripts/db-migrate.sh
ctest --test-dir back-end/build-full --output-on-failure
```

No macOS, acrescente ao configure com PostgreSQL
`-DCMAKE_PREFIX_PATH="$(brew --prefix libpqxx);$(brew --prefix libpq)"`.
Os testes PostgreSQL pulam sem ambiente: um resultado verde sem as variáveis
não comprova integração real.

```bash
cd front-end
npm ci
npm test
npm run build
npm run lint
npm run format:check
```

Com a API ligada a um **banco descartável**, execute na raiz:

```bash
python3 scripts/smoke-api.py --base-url http://127.0.0.1:8080
```

O smoke cria duas contas sintéticas e testa CRUD, perfil, credenciais após
troca de e-mail, recorrências, conflitos, relatórios, isolamento entre contas e
logout. Remove os recursos que criou mesmo em falhas; as contas permanecem,
pois não existe exclusão de usuário. Nunca execute contra dados de produção.

O CI executa testes de frontend, lint, build e formato. O job PostgreSQL
também compila HTTP e executa o smoke contra seu banco efêmero.

## Evidências desta execução

- Backend Debug e Release padrão: 36 testes cada, executados com sucesso.
- JSON sem HTTP: 41 testes executados com sucesso.
- HTTP + PostgreSQL real: 52 testes executados com sucesso, sem auto-skip
  dos testes de banco.
- Smoke API com PostgreSQL: 43 verificações passaram, incluindo isolamento A/B.
- Regressões de conflitos e saúde do banco falharam antes das correções e
  passaram depois. A queda de conexão foi simulada somente no processo de
  teste; o health retornou `degraded` e `connected:false`.
- Cadastro, criação de tarefa/meta/lembrete recorrente e novo login após
  reinício foram exercitados no navegador. Conta e dados foram preservados.
- Perfil atualizado e relido após recarregar; filtros combinados e estados
  vazios; agenda semanal com ocorrências e conflitos; exclusão cancelada e
  confirmada foram exercitados no navegador, com PostgreSQL real.
- A API do ambiente isolado foi parada e reiniciada: a interface exibiu o
  erro e recuperou a consulta pela ação de nova tentativa. Recarregar após
  o reinício levou ao login, conforme o ciclo de vida das sessões.
- Temas claro e escuro foram inspecionados visualmente.
- Frontend: 27 testes em quatro arquivos, build e lint executados com sucesso.
  Incluem cliente HTTP, componentes, formulários e Dashboard.
- Dashboard no navegador: seleção do calendário alterou somente a agenda;
  concluir uma tarefa atualizou os indicadores e o ranking pelo servidor.
- Imagens Docker de backend e web construídas; aplicação servida pelo Nginx
  com sessão e PostgreSQL. As 43 verificações do smoke também passaram pelo
  proxy web. Console do navegador sem erros/avisos no fluxo final.

O ambiente desta execução usa um projeto Compose isolado, com portas
15432/18080/18081 porque 5432 já estava ocupada. Isso não modifica as portas
padrão 5432/8080/8081 do projeto.

## Aprovações e limites

As issues #56–#62 pedem validação/aprovação nominal de colaboradores. Testes
automatizados e revisão técnica desta entrega **não representam** aprovação
de @danisjc6, @isabe1ltenorio, @laysabeatriizz, @SeveroGabriel ou @tiagojose76.
Essas aprovações devem ser registradas pelos responsáveis antes de considerar
cumpridos todos os critérios administrativos das respectivas issues.

- Sessões vivem em memória; reiniciar a API exige login novamente.
- Sem PostgreSQL, contas e recursos também são voláteis.
- Uma conexão perdida é detectada, mas não reconectada automaticamente.
  Restabeleça o banco e reinicie a API.
- O Compose usa HTTP e portas de loopback para uso local. Publicação na
  internet exige HTTPS, segredos próprios e configuração de produção.
- Notificações dependem da permissão do navegador e da aba aberta.
- A ausência de falhas nas verificações executadas não garante ausência de
  todo defeito; este documento delimita exatamente o que foi validado.
