// Configuração de acesso à API.
//
// `VITE_API_URL` decide se as telas falam com o backend ou rodam offline:
//
//   - não definida  → sem backend; a sessão fica em branco (ver session.ts)
//   - definida      → backend real, na base informada
//
// Meta, Tarefa e Lembrete têm endpoints no backend. Se a variável fosse
// obrigatória, quem clonasse o repositório e rodasse `npm run dev` veria as
// telas quebradas sem entender por quê.
//
// A base INCLUI o prefixo `/api`; os caminhos do cliente são relativos a ela
// (`/goals`, `/auth/login`). Repetir o prefixo dos dois lados produziria
// `/api/api/goals`.
//
// Valores típicos:
//
//   VITE_API_URL=/api                      # recomendado: proxy do Vite ou do nginx
//   VITE_API_URL=http://127.0.0.1:8080/api # backend direto, sem proxy
//
// O relativo é o recomendado, e não por gosto: o cookie de sessão é
// SameSite=Strict e só viaja em requisição do mesmo site. Apontando direto
// para outra origem, o login funciona e todas as chamadas seguintes voltam
// 401, porque o cookie fica para trás.

const rawBaseUrl = import.meta.env.VITE_API_URL;

// Barra no fim duplicaria a barra do caminho ("/api//goals"). O nginx trata,
// mas o log fica sujo e a comparação de origem no CORS não.
function normalize(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const apiBaseUrl: string | undefined =
  typeof rawBaseUrl === "string" && rawBaseUrl.trim() !== ""
    ? normalize(rawBaseUrl.trim())
    : undefined;

// Quem decide entre backend e mock. Exportado como função, e não como
// constante booleana, para deixar explícito no ponto de uso que a escolha vem
// de configuração e não de um flag de código.
export function isApiEnabled(): boolean {
  return apiBaseUrl !== undefined;
}
