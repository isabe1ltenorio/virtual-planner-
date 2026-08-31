// A base inclui /api; o proxy do Vite/nginx mantém API e sessão na mesma origem.
const rawBaseUrl = import.meta.env.VITE_API_URL;
export const apiBaseUrl: string =
  typeof rawBaseUrl === "string" && rawBaseUrl.trim() !== ""
    ? rawBaseUrl.trim().replace(/\/+$/, "")
    : "/api";
