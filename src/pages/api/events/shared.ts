import type { APIRoute } from "astro";
import { listPublishedEvents } from "@/lib/events/list-published-events";
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

  const result = await listPublishedEvents(supabase, locals.user.id);
  if ("error" in result) {
    return jsonResponse({ error: "internal" }, 500);
  }

  return jsonResponse({ events: result.events }, 200);
};
