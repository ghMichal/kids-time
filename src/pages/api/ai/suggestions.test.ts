import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_MODEL: "test-model",
}));

const { generateSuggestions } = vi.hoisted(() => ({
  generateSuggestions: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter-client", () => ({
  generateSuggestions,
  OpenRouterError: class OpenRouterError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/suggestions/enrich-suggestion-images", () => ({
  enrichSuggestionImages: vi.fn(),
}));

describe("POST /api/ai/suggestions", () => {
  beforeEach(() => {
    generateSuggestions.mockReset();
  });

  it("returns 401 unauthorized when locals.user is null without calling OpenRouter", async () => {
    const { POST } = await import("./suggestions");

    const response = await POST({
      request: new Request("http://localhost/api/ai/suggestions", { method: "POST" }),
      locals: { user: null },
    } as APIContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});
