import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_EVENT_SELECT_COLUMNS, toLibraryEventDto, type LibraryEventDto } from "@/lib/events/library-event-dto";
import type { Database } from "@/types";

export async function publishOwnEvent(
  client: SupabaseClient<Database>,
  ownerId: string,
  eventId: string,
): Promise<{ event: LibraryEventDto } | { error: "not_found" | "already_published" | "publish_failed" }> {
  const publishedAt = new Date().toISOString();

  const { data, error } = await client
    .from("events")
    .update({
      is_published: true,
      published_at: publishedAt,
    })
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .in("triage_status", ["accepted", "maybe"])
    .eq("is_published", false)
    .select(LIBRARY_EVENT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { error: "publish_failed" };
  }

  if (data) {
    const event = await toLibraryEventDto(client, ownerId, data);
    if (!event) {
      return { error: "publish_failed" };
    }
    return { event };
  }

  const { data: existing, error: lookupError } = await client
    .from("events")
    .select("id, is_published, triage_status")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (lookupError) {
    return { error: "publish_failed" };
  }

  if (existing?.is_published && (existing.triage_status === "accepted" || existing.triage_status === "maybe")) {
    return { error: "already_published" };
  }

  return { error: "not_found" };
}
