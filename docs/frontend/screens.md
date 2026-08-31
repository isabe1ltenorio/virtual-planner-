# Inventário de telas e rotas — P-7.1

Fonte do inventário para o AppShell e roteamento de P-37 (#27). A entrada
efetiva é `front-end/src/main.tsx` → `App.tsx`; o contrato de dados continua
em [api.md](../api.md). Este documento não define outro contrato de API.

## Decisões de P-7.1 (#78)

- `/` é o **Resumo do dia**: indicadores do dia do servidor, agenda e atalhos
  de criação. A análise de períodos fica em `/reports`.
- `/planner` é **Planejamento**: agenda de um dia ou semana selecionada, com
  tarefas e ocorrências de lembretes nos horários correspondentes. O dono
  funcional é P-41 (#59), que resolve a lacuna do inventário original.
- As sete rotas de P-37 são preservadas. `/reports`, `/login` e as rotas de
  formulário abaixo formalizam as telas adicionais já existentes.
- Não há tela ou decisão de domínio sem issue dona. A composição da navegação
  e esta distribuição de rotas são decisões de P-7.1.

## Rotas, dados e estados vazios

| Rota | Tela e propósito | Dados exibidos / estado vazio | Issue dona |
|---|---|---|---|
| `/` | Resumo do dia | Métricas do backend, tarefas do dia, metas em andamento e próximos lembretes; sem dados mostra contagens zero e indicadores indisponíveis, com atalhos para criar | P-43 (#60) |
| `/tasks` | Tarefas | Lista com data, categoria, prioridade, agendamento e status; sem resultado informa que nenhum item atende aos filtros | P-40 (#57) |
| `/planner` | Planejamento | Visões dia/semana, tarefas e ocorrências de lembretes, cores de categoria e conflitos de tarefas informados pelo backend; agenda vazia orienta criar itens ou mudar data | P-41 (#59) |
| `/goals` | Metas | Metas do período civil e data escolhidos, categoria e status; período vazio oferece criação e troca de filtro | P-39 (#56) |
| `/reminders` | Lembretes | Ocorrências na janela escolhida, categoria, tipo, recorrência e horário; sem ocorrências informa janela vazia e oferece criação | P-42 (#58) |
| `/profile` | Perfil | Nome e e-mail da conta autenticada, com edição; perfil indisponível mostra erro, nunca uma conta fictícia | P-45 (#62), backend P-33 (#53) |
| `/settings` | Configurações | Nome e perfil da aplicação, saúde da API e do PostgreSQL; banco não configurado é distinto de banco desconectado | P-45 (#62), cliente P-38 (#55) |
| `/reports` | Relatórios | Indicadores, semanas, meses, turnos e categorias produtivas do período; `null` aparece como sem dados, sem divisões feitas na tela | P-43 (#60) |
| `/login` | Entrada e cadastro | Nome no cadastro, e-mail e senha; validação e falha de autenticação visíveis; fora do AppShell | P-38 (#55), autenticação #111–#113 |
| `/goals/new`, `/goals/:id/edit` | Formulário de meta | Descrição, categoria, período e data; status só na edição; item inexistente mostra erro e retorno à lista | P-39 (#56) |
| `/tasks/new`, `/tasks/:id/edit` | Formulário de tarefa | Descrição, categoria, data, intervalo ou turno e prioridade; status só na edição; erro ao carregar impede salvar | P-40 (#57) |
| `/reminders/new`, `/reminders/:id/edit` | Formulário de lembrete | Descrição, categoria, data-base, horário, tipo e recorrência; edição busca por ID, inclusive fora da janela da lista | P-42 (#58) |

## Navegação

A Sidebar segue esta ordem: **Resumo do dia → Tarefas → Metas → Lembretes →
Planejamento → Relatórios**, separador, **Perfil → Configurações**. **Sair**
encerra a sessão e volta ao login. A rota ativa fica destacada.

O Header mostra o título da seção e, na ordem, controle de notificações,
seletor **Claro / Escuro / Sistema** e **Nova tarefa** (`/tasks/new`).
Formulários oferecem retorno à sua lista. O login não mostra Sidebar/Header.

## Carregamento, erro e interação

P-46 (#63) define os estados comuns: carregamento visível enquanto a API
responde; mensagem de erro com nova tentativa/retorno quando aplicável; vazio
explicado conforme a tabela. Nenhuma falha deve virar lista vazia silenciosa.
Na edição, o formulário só pode salvar depois de carregar o recurso por ID.
O envio em andamento desabilita novas submissões; exclusão exige confirmação.

Todas as rotas internas exigem sessão. O cliente preserva o cookie HttpOnly;
não há dados fictícios usados como autenticação ou fallback de rede. Cores por
categoria vêm de uma única paleta (P-44, #61); texto e rótulos continuam
identificando a categoria sem depender só da cor.

## Relação com as ondas

- **Onda 1:** P-7.1 (#78) fornece o inventário; P-37 (#27) monta o roteamento;
  P-64 (#39) entrega os componentes visuais sem dados de domínio.
- **Onda 5:** P-38 (#55) conecta a API; P-39 a P-45 (#56–#62) entregam telas;
  P-46 (#63) padroniza estados; P-47 (#64) e P-48 (#65) validam qualidade.
- A aprovação funcional nominal pedida nas issues continua sendo realizada
  pelos respectivos colaboradores; este inventário não registra aprovação.
