import { request } from "./httpClient";

export interface ApiHealth {
  app: string;
  profile: string;
  status: "ok" | "degraded";
  database: { configured: boolean; connected: boolean };
}

export function getHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("/health");
}
