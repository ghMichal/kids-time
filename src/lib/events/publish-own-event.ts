import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryEventDto } from "@/lib/events/list-own-events";
import type { Database } from "@/types";

const SELECT_COLUMNS =
  "id, title, summary, description, place, child_age_years, location_kind, source_url, triage_status, updated_at, is_published, published_at" as const;

function toLibraryEventDto(row: {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  place: string | null;
  child_age_years: number | null;
  location_kind: "indoor" | "outdoor" | null;
  source_url: string | null;
  triage_status: string | null;
  updated_at: string;
  is_published: boolean;
  published_at: string | null;
}): LibraryEventDto | null {
  if (row.triage_status !== "accepted" && row.triage_status !== "maybe") {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    place: row.place,
    child_age_years: row.child_age_years,
    location_kind: row.location_kind,
    source_url: row.source_url,
    triage_status: row.triage_status,
    updated_at: row.updated_at,
    is_published: row.is_published,
    published_at: row.published_at,
  };
}

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
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { error: "publish_failed" };
  }

  if (data) {
    const event = toLibraryEventDto(data);
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
