import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { buildEventSummaryPrompt } from "@/lib/ai/build-event-summary-prompt";
import { buildSuggestionPrompt, type OpenRouterMessage } from "@/lib/ai/build-suggestion-prompt";
import type { EventSummaryRequest } from "@/lib/ai/event-summary-request.schema";
import {
  eventSummaryOpenRouterResponseFormat,
  eventSummaryResponseFromModelSchema,
  eventSummaryResponseSchema,
  type EventSummaryResponse,
} from "@/lib/ai/event-summary-response.schema";
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

interface OpenRouterChatRequest {
  messages: OpenRouterMessage[];
  responseFormat: unknown;
}

function assertOpenRouterConfigured(): void {
  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    throw new OpenRouterError(
      "configuration",
      "OpenRouter is not configured. Set OPENROUTER_API_KEY and OPENROUTER_MODEL.",
    );
  }
}

async function requestChatCompletionContent(input: OpenRouterChatRequest): Promise<unknown> {
  assertOpenRouterConfigured();

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
        messages: input.messages,
        temperature: 0.3,
        response_format: input.responseFormat,
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

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new OpenRouterError("invalid_response", "OpenRouter content is not valid JSON.");
  }
}

export async function generateSuggestions(criteria: SuggestionRequest): Promise<SuggestionResponse> {
  const { messages } = buildSuggestionPrompt(criteria);
  const parsed = await requestChatCompletionContent({
    messages,
    responseFormat: openRouterResponseFormat,
  });

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

export async function generateEventSummary(input: EventSummaryRequest): Promise<EventSummaryResponse> {
  const { messages } = buildEventSummaryPrompt(input);
  const parsed = await requestChatCompletionContent({
    messages,
    responseFormat: eventSummaryOpenRouterResponseFormat,
  });

  const fromModel = eventSummaryResponseFromModelSchema.safeParse(parsed);
  if (!fromModel.success) {
    throw new OpenRouterError("invalid_response", "OpenRouter response does not match expected shape.");
  }

  const normalized = eventSummaryResponseSchema.safeParse(fromModel.data);
  if (!normalized.success) {
    throw new OpenRouterError("invalid_response", "Event summary failed validation.");
  }

  return normalized.data;
}
