import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateEventSummary, generateSuggestions, OpenRouterError } from "@/lib/ai/openrouter-client";

const { env, fetchMock } = vi.hoisted(() => ({
  env: {
    apiKey: "test-key",
    model: "test-model",
  },
  fetchMock: vi.fn(),
}));

vi.mock("astro:env/server", () => ({
  get OPENROUTER_API_KEY() {
    return env.apiKey;
  },
  get OPENROUTER_MODEL() {
    return env.model;
  },
}));

const SUGGESTION_REQUEST = {
  place: "City park",
  time: "Saturday morning",
  childAge: 5,
  indoorOutdoor: "outdoor",
} as const;

const SUMMARY_REQUEST = {
  title: "Park visit",
} as const;

const TITLE_101 = "t".repeat(101);
const SUMMARY_201 = "s".repeat(201);

const VALID_SUGGESTION_ITEM = {
  title: "Park visit",
  summary: "Walk around the playground.",
  sourceUrl: "https://example.com/park",
};

function jsonResponse(body: unknown, status = 200): Response {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completionResponse(content: string | null | undefined): Response {
  return jsonResponse({
    choices: [{ message: { content } }],
  });
}

function contentResponse(content: unknown): Response {
  return completionResponse(JSON.stringify(content));
}

async function expectOpenRouterError(
  promise: Promise<unknown>,
  code: OpenRouterError["code"],
  message: string,
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(OpenRouterError);
  await expect(promise).rejects.toMatchObject({ code, message });
}

describe("openrouter-client taxonomy", () => {
  beforeEach(() => {
    env.apiKey = "test-key";
    env.model = "test-model";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  describe("shared requestChatCompletionContent", () => {
    it("maps TimeoutError to timeout without waiting for AbortSignal", async () => {
      fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

      await expectOpenRouterError(generateSuggestions(SUGGESTION_REQUEST), "timeout", "OpenRouter request timed out.");
    });

    it("maps a non-timeout fetch throw to upstream", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      await expectOpenRouterError(generateSuggestions(SUGGESTION_REQUEST), "upstream", "Failed to reach OpenRouter.");
    });

    it("maps a 401 !ok response to upstream, not configuration", async () => {
      fetchMock.mockResolvedValue(jsonResponse("unauthorized", 401));

      await expectOpenRouterError(generateSuggestions(SUGGESTION_REQUEST), "upstream", "OpenRouter request failed.");
    });

    it("maps HTTP 200 non-JSON body to invalid_response", async () => {
      fetchMock.mockResolvedValue(new Response("<html>not json</html>", { status: 200 }));

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "OpenRouter returned invalid JSON.",
      );
    });

    it("maps HTTP 200 JSON without message content to invalid_response", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "OpenRouter returned empty content.",
      );
    });

    it("maps HTTP 200 empty message content to invalid_response", async () => {
      fetchMock.mockResolvedValue(completionResponse(""));

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "OpenRouter returned empty content.",
      );
    });

    it("maps HTTP 200 content that is not JSON to invalid_response", async () => {
      fetchMock.mockResolvedValue(completionResponse("not-json"));

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "OpenRouter content is not valid JSON.",
      );
    });

    it("throws configuration before fetch when env getters are empty", async () => {
      env.apiKey = "";
      env.model = "";

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "configuration",
        "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL.",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("generateSuggestions", () => {
    it("maps content JSON that fails fromModel to invalid_response", async () => {
      fetchMock.mockResolvedValue(contentResponse({ notSuggestions: true }));

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "OpenRouter response does not match expected shape.",
      );
    });

    it("maps fromModel-ok product-fail (title 101) to invalid_response", async () => {
      fetchMock.mockResolvedValue(
        contentResponse({
          suggestions: [{ ...VALID_SUGGESTION_ITEM, title: TITLE_101 }],
        }),
      );

      await expectOpenRouterError(
        generateSuggestions(SUGGESTION_REQUEST),
        "invalid_response",
        "Suggestions failed validation.",
      );
    });

    it("resolves a single legal suggestion without judging text quality", async () => {
      fetchMock.mockResolvedValue(contentResponse({ suggestions: [VALID_SUGGESTION_ITEM] }));

      await expect(generateSuggestions(SUGGESTION_REQUEST)).resolves.toEqual({
        suggestions: [VALID_SUGGESTION_ITEM],
      });
    });
  });

  describe("generateEventSummary", () => {
    it("maps content JSON that fails fromModel to invalid_response", async () => {
      fetchMock.mockResolvedValue(contentResponse({}));

      await expectOpenRouterError(
        generateEventSummary(SUMMARY_REQUEST),
        "invalid_response",
        "OpenRouter response does not match expected shape.",
      );
    });

    it("maps fromModel-ok product-fail (summary 201) to invalid_response", async () => {
      fetchMock.mockResolvedValue(contentResponse({ summary: SUMMARY_201 }));

      await expectOpenRouterError(
        generateEventSummary(SUMMARY_REQUEST),
        "invalid_response",
        "Event summary failed validation.",
      );
    });

    it("resolves a 1–200 character summary without judging text quality", async () => {
      fetchMock.mockResolvedValue(contentResponse({ summary: "A short walk in the park." }));

      await expect(generateEventSummary(SUMMARY_REQUEST)).resolves.toEqual({
        summary: "A short walk in the park.",
      });
    });
  });
});
