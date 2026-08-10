import type { APIRoute } from "astro";
import { createManualEvent } from "@/lib/events/create-manual-event";
import { listOwnLibraryEvents } from "@/lib/events/list-own-events";
import { manualEventCreateSchema } from "@/lib/events/manual-event-create.schema";
import { createClient } from "@/lib/supabase";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const GET: APIRoute = async ({ request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await listOwnLibraryEvents(supabase, locals.user.id);
  if ("error" in result) {
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ events: result.events }, 200);
};

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

  const parsed = manualEventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.issues }, 400);
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await createManualEvent(supabase, {
    ownerId: locals.user.id,
    ...parsed.data,
  });

  if ("error" in result) {
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ event: result.event }, 201);
};
