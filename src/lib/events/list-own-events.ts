import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const LIST_COLUMNS =
  "id, title, summary, description, place, child_age_years, location_kind, source_url, triage_status, updated_at, is_published, published_at" as const;

export interface LibraryEventDto {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  place: string | null;
  child_age_years: number | null;
  location_kind: "indoor" | "outdoor" | null;
  source_url: string | null;
  triage_status: "accepted" | "maybe";
  updated_at: string;
  is_published: boolean;
  published_at: string | null;
}

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

export async function listOwnLibraryEvents(
  client: SupabaseClient<Database>,
  ownerId: string,
): Promise<{ events: LibraryEventDto[] } | { error: "list_failed" }> {
  const { data, error } = await client
    .from("events")
    .select(LIST_COLUMNS)
    .eq("owner_id", ownerId)
    .in("triage_status", ["accepted", "maybe"])
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: "list_failed" };
  }

  const events: LibraryEventDto[] = [];
  for (const row of data) {
    const dto = toLibraryEventDto(row);
    if (dto) {
      events.push(dto);
    }
  }

  return { events };
}
