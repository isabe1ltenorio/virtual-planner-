import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "./httpClient";

describe("request", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns JSON and sends the session cookie with GET requests", async () => {
    const payload = [{ id: 1, description: "Estudar C++" }];
    fetchMock.mockResolvedValueOnce(Response.json(payload));

    const result = await request("/tasks");

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/tasks", {
      method: "GET",
      credentials: "include",
      headers: {},
      body: undefined,
    });
  });

  it("serializes the body and sends the session cookie with mutations", async () => {
    const payload = { description: "Estudar C++" };
    fetchMock.mockResolvedValueOnce(Response.json({ id: 1, ...payload }));

    const result = await request("/tasks", { method: "POST", body: payload });

    expect(result).toEqual({ id: 1, ...payload });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/tasks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("encodes query values without changing their meaning", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));

    await request("/goals", {
      query: { status: "In Progress", description: "C++ & revisão" },
    });

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/goals?status=In+Progress&description=C%2B%2B+%26+revis%C3%A3o",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("returns undefined for a successful deletion with no response body", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await request<void>("/tasks/1", { method: "DELETE" });

    expect(result).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/tasks/1",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it.each([
    { status: 401, code: "invalid_credentials" },
    { status: 404, code: "not_found" },
    { status: 409, code: "conflict" },
  ])("preserves structured HTTP errors ($status)", async ({ status, code }) => {
    const message = "Não foi possível concluir a operação.";
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code, message } }, { status }),
    );

    const result = request("/tasks/1");

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status,
      code,
      message,
      isUnauthorized: status === 401,
      isNotFound: status === 404,
    });
  });

  it("converts a non-JSON proxy error into an ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );

    const result = request("/tasks");

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 502,
      code: "internal_error",
      message: "A API respondeu 502.",
    });
  });

  it("converts a network failure into an ApiError without an HTTP status", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = request("/tasks");

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 0,
      code: "network_error",
      message: "Não foi possível alcançar a API. Ela está rodando?",
    });
  });
});
