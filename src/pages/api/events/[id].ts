import type { APIRoute } from "astro";
import { deleteOwnEvent } from "@/lib/events/delete-own-event";
import { eventIdParamSchema, eventUpdateSchema } from "@/lib/events/event-update.schema";
import { updateOwnEvent } from "@/lib/events/update-own-event";
import { createClient } from "@/lib/supabase";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const PATCH: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const idParsed = eventIdParamSchema.safeParse(params.id);
  if (!idParsed.success) {
    return jsonResponse({ error: "validation", issues: idParsed.error.issues }, 400);
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

  const parsed = eventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "validation", issues: parsed.error.issues }, 400);
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await updateOwnEvent(supabase, locals.user.id, idParsed.data, parsed.data);
  if ("error" in result) {
    if (result.error === "not_found") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ event: result.event }, 200);
};

export const DELETE: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const idParsed = eventIdParamSchema.safeParse(params.id);
  if (!idParsed.success) {
    return jsonResponse({ error: "validation", issues: idParsed.error.issues }, 400);
  }

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await deleteOwnEvent(supabase, locals.user.id, idParsed.data);
  if ("error" in result) {
    if (result.error === "not_found") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    return jsonResponse({ error: "internal" }, 500);
  }

  return new Response(null, { status: 204 });
};
