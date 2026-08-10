import type { APIRoute } from "astro";
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import { generateEventSummary, OpenRouterError } from "@/lib/ai/openrouter-client";
import { eventSummaryRequestSchema } from "@/lib/ai/event-summary-request.schema";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    return jsonResponse({ error: "invalid_content_type" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const parsed = eventSummaryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.issues }, 400);
  }

  if (!OPENROUTER_API_KEY || !OPENROUTER_MODEL) {
    return jsonResponse({ error: "configuration", message: "OpenRouter is not configured." }, 503);
  }

  try {
    const result = await generateEventSummary(parsed.data);
    return jsonResponse({ summary: result.summary }, 200);
  } catch (error) {
    if (error instanceof OpenRouterError) {
      switch (error.code) {
        case "configuration":
          return jsonResponse({ error: "configuration", message: error.message }, 503);
        case "timeout":
          return jsonResponse({ error: "timeout", message: error.message }, 504);
        case "upstream":
        case "invalid_response":
          return jsonResponse({ error: error.code, message: error.message }, 502);
      }
    }

    return jsonResponse({ error: "internal", message: "Unexpected error." }, 500);
  }
};
