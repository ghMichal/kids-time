import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { buildSuggestionPrompt } from "@/lib/ai/build-suggestion-prompt";
import type { SuggestionRequest } from "@/lib/ai/suggestion-request.schema";
import {
  openRouterResponseFormat,
  suggestionResponseFromModelSchema,
  suggestionResponseSchema,
  type SuggestionResponse,
} from "@/lib/ai/suggestion-response.schema";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const UPSTREAM_TIMEOUT_MS = 25_000;

export type OpenRouterErrorCode = "configuration" | "upstream" | "timeout" | "invalid_response";

export class OpenRouterError extends Error {
  readonly code: OpenRouterErrorCode;

  constructor(code: OpenRouterErrorCode, message: string) {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
  }
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

function assertOpenRouterConfigured(): void {
  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    throw new OpenRouterError(
      "configuration",
      "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL.",
    );
  }
}

export async function generateSuggestions(criteria: SuggestionRequest): Promise<SuggestionResponse> {
  assertOpenRouterConfigured();

  const { messages } = buildSuggestionPrompt(criteria);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kids-time.app",
        "X-Title": "kids-time",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.3,
        response_format: openRouterResponseFormat,
        provider: { require_parameters: true },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new OpenRouterError("timeout", "OpenRouter request timed out.");
    }
    throw new OpenRouterError("upstream", "Failed to reach OpenRouter.");
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new OpenRouterError("upstream", "OpenRouter request failed.");
  }

  let payload: ChatCompletionResponse;
  try {
    payload = JSON.parse(responseText) as ChatCompletionResponse;
  } catch {
    throw new OpenRouterError("invalid_response", "OpenRouter returned invalid JSON.");
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterError("invalid_response", "OpenRouter returned empty content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new OpenRouterError("invalid_response", "OpenRouter content is not valid JSON.");
  }

  const fromModel = suggestionResponseFromModelSchema.safeParse(parsed);
  if (!fromModel.success) {
    throw new OpenRouterError("invalid_response", "OpenRouter response does not match expected shape.");
  }

  const normalized = suggestionResponseSchema.safeParse(fromModel.data);
  if (!normalized.success) {
    throw new OpenRouterError("invalid_response", "Suggestions failed validation.");
  }

  return normalized.data;
}
