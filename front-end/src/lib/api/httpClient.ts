// Cliente HTTP da API.
//
// Duas decisões que não são detalhe:
//
// 1. `credentials: "include"` em toda requisição. A sessão do backend é um
//    cookie `HttpOnly` — o JavaScript não consegue lê-lo nem colocá-lo num
//    header à mão. Sem esta linha o navegador simplesmente não envia o cookie,
//    e toda chamada volta 401 sem explicação aparente.
//
// 2. O erro do backend vira `ApiError` com o `code` preservado. A API responde
//    `{"error":{"code":"...","message":"..."}}` de forma consistente, e jogar
//    isso fora obrigaria cada tela a adivinhar o motivo pelo status HTTP.

import { apiBaseUrl } from "./config";

export type ApiErrorCode =
  | "validation_error"
  | "not_found"
  | "conflict"
  | "unauthorized"
  | "invalid_credentials"
  | "internal_error"
  | "network_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  // Açúcar para as telas: `if (error.isUnauthorized)` lê melhor que comparar
  // 401 na mão em cada `catch`.
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string>;
}

function buildUrl(path: string, query?: Record<string, string>): string {
  if (apiBaseUrl === undefined) {
    throw new Error(
      "VITE_API_URL não está definida: o cliente HTTP não deveria ter sido chamado.",
    );
  }

  const url = `${apiBaseUrl}${path}`;

  if (query === undefined || Object.keys(query).length === 0) {
    return url;
  }

  return `${url}?${new URLSearchParams(query).toString()}`;
}

async function toApiError(response: Response): Promise<ApiError> {
  // O corpo de erro pode não vir — um 502 do proxy, por exemplo, não é JSON.
  try {
    const body = await response.json();
    const error = body?.error;

    if (typeof error?.code === "string" && typeof error?.message === "string") {
      return new ApiError(response.status, error.code, error.message);
    }
  } catch {
    // Cai no genérico abaixo.
  }

  return new ApiError(
    response.status,
    "internal_error",
    `A API respondeu ${response.status}.`,
  );
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query } = options;

  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      // Sem isto o cookie de sessão não viaja. Ver o comentário do topo.
      credentials: "include",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch só rejeita por falha de rede: backend fora do ar, DNS, CORS
    // bloqueado. Status HTTP de erro resolve normalmente.
    throw new ApiError(
      0,
      "network_error",
      "Não foi possível alcançar a API. Ela está rodando?",
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204 não tem corpo, e `response.json()` num corpo vazio lança.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
