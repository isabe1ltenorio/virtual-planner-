// Quem está logado.
//
// Não há token guardado em lugar nenhum: a sessão é um cookie `HttpOnly` que o
// JavaScript nem consegue ler. A única forma de saber se ela vale é perguntar
// ao servidor, e é isso que `GET /api/auth/me` faz.
//
// Como consequência, `localStorage` fica fora do caminho — e é justamente por
// isso que um XSS nesta aplicação não rouba a sessão de ninguém.

import { ApiError, request } from "./httpClient";
import { isApiEnabled } from "./config";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

// `null` significa "não autenticado", e não "deu erro". Falha de rede continua
// subindo como exceção, porque tratar backend fora do ar como logout silencioso
// esconderia o problema real de quem está desenvolvendo.
export async function currentUser(): Promise<SessionUser | null> {
  // Com os mocks não há sessão nem login: a aplicação inteira é local.
  if (!isApiEnabled()) {
    return { id: 0, name: "Modo mock", email: "mock@local" };
  }

  try {
    return await request<SessionUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      return null;
    }

    throw error;
  }
}
