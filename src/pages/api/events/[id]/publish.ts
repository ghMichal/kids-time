import type { APIRoute } from "astro";
import { eventIdParamSchema } from "@/lib/events/event-update.schema";
import { publishOwnEvent } from "@/lib/events/publish-own-event";
import { createClient } from "@/lib/supabase";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
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

  const result = await publishOwnEvent(supabase, locals.user.id, idParsed.data);
  if ("error" in result) {
    if (result.error === "not_found") {
      return jsonResponse({ error: "not_found" }, 404);
    }
    if (result.error === "already_published") {
      return jsonResponse({ error: "already_published" }, 409);
    }
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ event: result.event }, 200);
};
