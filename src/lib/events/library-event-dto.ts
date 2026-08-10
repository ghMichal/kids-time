import type { SupabaseClient } from "@supabase/supabase-js";
import { createEventImageSignedUrl } from "@/lib/storage/event-image";
import type { Database } from "@/types";

export const LIBRARY_EVENT_SELECT_COLUMNS =
  "id, title, summary, description, place, child_age_years, location_kind, source_url, triage_status, updated_at, is_published, published_at, image_path" as const;

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
  imageUrl: string | null;
}

export interface LibraryEventRow {
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
  image_path: string | null;
}

export async function toLibraryEventDto(
  client: SupabaseClient<Database>,
  ownerId: string,
  row: LibraryEventRow,
): Promise<LibraryEventDto | null> {
  if (row.triage_status !== "accepted" && row.triage_status !== "maybe") {
    return null;
  }

  const imageUrl = row.image_path ? await createEventImageSignedUrl(client, row.image_path, ownerId) : null;

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
    imageUrl,
  };
}
