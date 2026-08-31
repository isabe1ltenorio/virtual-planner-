import type { User } from "../../types/domain";
import { request } from "./httpClient";

export function getProfile(): Promise<User> {
  return request<User>("/users/me");
}

export function updateProfile(
  profile: Partial<Pick<User, "name" | "email">>,
): Promise<User> {
  return request<User>("/users/me", { method: "PATCH", body: profile });
}
