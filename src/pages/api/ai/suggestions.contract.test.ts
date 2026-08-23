import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, generateSuggestions, OpenRouterError } = vi.hoisted(() => {
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
    generateSuggestions: vi.fn(),
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
  generateSuggestions,
  OpenRouterError,
}));

vi.mock("@/lib/suggestions/enrich-suggestion-images", () => ({
  enrichSuggestionImages: vi.fn(),
}));

const VALID_BODY = {
  place: "City park",
  time: "Saturday morning",
  childAge: 5,
  indoorOutdoor: "outdoor" as const,
};

function createAuthenticatedRequest(body: unknown = VALID_BODY): Request {
  return new Request("http://localhost/api/ai/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/suggestions — OpenRouter error contract", () => {
  beforeEach(() => {
    env.apiKey = "test-key";
    env.model = "test-model";
    generateSuggestions.mockReset();
  });

  it.each([
    ["configuration", 503],
    ["timeout", 504],
    ["upstream", 502],
    ["invalid_response", 502],
  ] as const)("maps OpenRouterError %s to HTTP %i", async (code, status) => {
    const { POST } = await import("./suggestions");

    generateSuggestions.mockRejectedValue(new OpenRouterError(code, `${code} message`));

    const response = await POST({
      request: createAuthenticatedRequest(),
      locals: { user: { id: "user-1" } },
    } as APIContext);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      error: code,
      message: `${code} message`,
    });
    expect(generateSuggestions).toHaveBeenCalledOnce();
  });

  it("returns 503 configuration without calling generateSuggestions when env is empty", async () => {
    env.apiKey = "";
    env.model = "";

    const { POST } = await import("./suggestions");

    const response = await POST({
      request: createAuthenticatedRequest(),
      locals: { user: { id: "user-1" } },
    } as APIContext);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "configuration",
      message: "OpenRouter is not configured.",
    });
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});
