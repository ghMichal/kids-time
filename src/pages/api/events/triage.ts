import type { APIRoute } from "astro";
import { createEventFromSuggestion } from "@/lib/events/create-event-from-suggestion";
import { triageRequestSchema } from "@/lib/events/triage-request.schema";
import { createClient } from "@/lib/supabase";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const POST: APIRoute = async ({ request, locals, cookies }) => {
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

  const parsed = triageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.issues }, 400);
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await createEventFromSuggestion(supabase, {
    ownerId: locals.user.id,
    triageStatus: parsed.data.triageStatus,
    suggestion: parsed.data.suggestion,
    criteria: parsed.data.criteria,
  });

  if ("error" in result) {
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ event: result.event }, 201);
};
