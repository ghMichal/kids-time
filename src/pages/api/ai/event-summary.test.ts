import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, generateEventSummary, OpenRouterError } = vi.hoisted(() => {
  class MockOpenRouterError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }

  return {
    env: {
      apiKey: "test-key",
      model: "test-model",
    },
    generateEventSummary: vi.fn(),
    OpenRouterError: MockOpenRouterError,
  };
});

vi.mock("astro:env/server", () => ({
  get OPENROUTER_API_KEY() {
    return env.apiKey;
  },
  get OPENROUTER_MODEL() {
    return env.model;
  },
}));

vi.mock("@/lib/ai/openrouter-client", () => ({
  generateEventSummary,
  OpenRouterError,
}));

const VALID_BODY = {
  title: "Park visit",
};

function createAuthenticatedRequest(body: unknown = VALID_BODY): Request {
  return new Request("http://localhost/api/ai/event-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/event-summary", () => {
  beforeEach(() => {
    env.apiKey = "test-key";
    env.model = "test-model";
    generateEventSummary.mockReset();
  });

  it("returns 401 unauthorized when locals.user is null without calling generateEventSummary", async () => {
    const { POST } = await import("./event-summary");

    const response = await POST({
      request: new Request("http://localhost/api/ai/event-summary", { method: "POST" }),
      locals: { user: null },
    } as APIContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(generateEventSummary).not.toHaveBeenCalled();
  });

  it.each([
    ["configuration", 503],
    ["timeout", 504],
    ["upstream", 502],
    ["invalid_response", 502],
  ] as const)("maps OpenRouterError %s to HTTP %i", async (code, status) => {
    const { POST } = await import("./event-summary");

    generateEventSummary.mockRejectedValue(new OpenRouterError(code, `${code} message`));

    const response = await POST({
      request: createAuthenticatedRequest(),
      locals: { user: { id: "user-1" } },
    } as APIContext);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: code,
      message: `${code} message`,
    });
    expect(generateEventSummary).toHaveBeenCalledOnce();
  });

  it("returns 503 configuration without calling generateEventSummary when env is empty", async () => {
    env.apiKey = "";
    env.model = "";

    const { POST } = await import("./event-summary");

    const response = await POST({
      request: createAuthenticatedRequest(),
      locals: { user: { id: "user-1" } },
    } as APIContext);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "configuration",
      message: "OpenRouter is not configured.",
    });
    expect(generateEventSummary).not.toHaveBeenCalled();
  });
});
