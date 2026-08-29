// Autenticação.
//
// Nenhuma destas funções devolve token: o backend responde com um cookie
// `HttpOnly`, e o navegador o guarda e reenvia sozinho enquanto o cliente usar
// `credentials: "include"`. Não há nada a armazenar no `localStorage` — e é
// justamente isso que impede um XSS de roubar a sessão.

import { request } from "./httpClient";

export interface RegisteredUser {
  id: number;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

// A senha exige no mínimo 12 caracteres; menos que isso volta 400 com
// `code: "validation_error"`.
export async function register(
  data: Credentials & { name: string },
): Promise<RegisteredUser> {
  return request<RegisteredUser>("/auth/register", {
    method: "POST",
    body: data,
  });
}

// Responde 204 e devolve o cookie no `Set-Cookie`. Credencial errada volta 401
// com `code: "invalid_credentials"` — a mesma resposta para e-mail inexistente
// e para senha errada, para não entregar quem tem conta.
export async function login(data: Credentials): Promise<void> {
  await request<void>("/auth/login", { method: "POST", body: data });
}

export async function logout(): Promise<void> {
  await request<void>("/auth/logout", { method: "POST" });
}
