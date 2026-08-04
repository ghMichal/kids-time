import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const LIST_COLUMNS =
  "id, title, summary, place, child_age_years, location_kind, source_url, published_at, updated_at" as const;

export interface SharedEventDto {
  id: string;
  title: string;
  summary: string | null;
  place: string | null;
  child_age_years: number | null;
  location_kind: "indoor" | "outdoor" | null;
  source_url: string | null;
  published_at: string | null;
}

function toSharedEventDto(row: {
  id: string;
  title: string;
  summary: string | null;
  place: string | null;
  child_age_years: number | null;
  location_kind: "indoor" | "outdoor" | null;
  source_url: string | null;
  published_at: string | null;
}): SharedEventDto {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    place: row.place,
    child_age_years: row.child_age_years,
    location_kind: row.location_kind,
    source_url: row.source_url,
    published_at: row.published_at,
  };
}

export async function listPublishedEvents(
  client: SupabaseClient<Database>,
  viewerId: string,
): Promise<{ events: SharedEventDto[] } | { error: "list_failed" }> {
  const { data, error } = await client
    .from("events")
    .select(LIST_COLUMNS)
    .eq("is_published", true)
    .neq("owner_id", viewerId)
    .order("published_at", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: "list_failed" };
  }

  return { events: data.map(toSharedEventDto) };
}
