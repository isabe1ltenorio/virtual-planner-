# Virtual Planner - Front-end

Aplicação web desenvolvida com React, TypeScript e Tailwind CSS v4.

Use Node.js 22.13+ e execute os comandos abaixo dentro de `front-end/`.

## Scripts Disponíveis

- `npm ci` - Instala as versões registradas no lockfile.
- `npm run dev` - Roda o servidor de desenvolvimento local.
- `npm run build` - Gera a build otimizada para produção.
- `npm run lint` - Verifica TypeScript, regras do React e dos hooks com ESLint.
- `npm run format` - Aplica a formatação com Prettier.
- `npm run format:check` - Verifica a formatação sem alterar arquivos.
- `npm test` - Executa todos os testes uma vez, inclusive no CI.
- `npm run test:watch` - Reexecuta os testes durante o desenvolvimento.
- `npm run preview` - Serve a build de produção localmente.

## Qualidade e testes

O ESLint usa as recomendações de JavaScript, TypeScript, React Hooks e React
Refresh. Não use `any`, `@ts-ignore` nem desabilite regras para esconder erros.
O Prettier usa indentação de dois espaços, aspas duplas, ponto e vírgula e largura
de 80 colunas. `node_modules/`, `dist/`, `coverage/` e o lockfile são ignorados
pelo formatador; o lockfile deve ser atualizado apenas pelo npm.

Os testes usam Vitest, React Testing Library e jsdom. Escreva casos
`*.test.ts` ou `*.test.tsx` com preparação, ação e verificação separadas.
O cliente HTTP é exercitado com respostas reais de `Response`, substituindo
apenas a fronteira de rede (`fetch`). Os testes de componente renderizam a
implementação real e verificam a interação do usuário com a interface.

`vitest.config.ts` define `VITE_API_URL=/api` somente nos testes, que não
dependem de backend nem de credenciais reais. Essa suíte não substitui a
validação de integração com a API ou a verificação visual no navegador.

Antes de entregar alterações, execute `npm test`, `npm run build`,
`npm run lint` e `npm run format:check`.
