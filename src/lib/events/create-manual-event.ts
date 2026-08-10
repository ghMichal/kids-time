import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManualEventCreateRequest } from "@/lib/events/manual-event-create.schema";
import type { LibraryEventDto } from "@/lib/events/list-own-events";
import type { Database, TablesInsert } from "@/types";

const SELECT_COLUMNS =
  "id, title, summary, description, place, child_age_years, location_kind, source_url, triage_status, updated_at, is_published, published_at" as const;

export type CreateManualEventInput = ManualEventCreateRequest & {
  ownerId: string;
};

function mapManualEventInsert(input: CreateManualEventInput): TablesInsert<"events"> {
  return {
    owner_id: input.ownerId,
    title: input.title,
    summary: input.summary ?? null,
    description: input.description ?? null,
    place: input.place ?? null,
    child_age_years: input.childAge ?? null,
    location_kind: input.locationKind ?? null,
    origin: "manual",
    triage_status: "accepted",
    is_published: false,
    image_path: null,
    starts_at: null,
    source_url: null,
  };
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

export async function createManualEvent(
  client: SupabaseClient<Database>,
  input: CreateManualEventInput,
): Promise<{ event: LibraryEventDto } | { error: "insert_failed" }> {
  const payload = mapManualEventInsert(input);

  const { data, error } = await client.from("events").insert(payload).select(SELECT_COLUMNS).single();

  if (error) {
    return { error: "insert_failed" };
  }

  const event = toLibraryEventDto(data);
  if (!event) {
    return { error: "insert_failed" };
  }

  return { event };
}
