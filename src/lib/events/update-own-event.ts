import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventUpdateRequest } from "@/lib/events/event-update.schema";
import type { LibraryEventDto } from "@/lib/events/list-own-events";
import type { Database, TablesUpdate } from "@/types";

const SELECT_COLUMNS =
  "id, title, summary, description, place, child_age_years, location_kind, source_url, triage_status, updated_at" as const;

function mapUpdatePayload(input: EventUpdateRequest): TablesUpdate<"events"> {
  const payload: TablesUpdate<"events"> = {};

  if (input.title !== undefined) {
    payload.title = input.title;
  }
  if (input.summary !== undefined) {
    payload.summary = input.summary;
  }
  if (input.description !== undefined) {
    payload.description = input.description;
  }
  if (input.place !== undefined) {
    payload.place = input.place;
  }
  if (input.childAge !== undefined) {
    payload.child_age_years = input.childAge;
  }
  if (input.locationKind !== undefined) {
    payload.location_kind = input.locationKind;
  }

  return payload;
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
  };
}

export async function updateOwnEvent(
  client: SupabaseClient<Database>,
  ownerId: string,
  eventId: string,
  input: EventUpdateRequest,
): Promise<{ event: LibraryEventDto } | { error: "not_found" | "update_failed" }> {
  const payload = mapUpdatePayload(input);

  const { data, error } = await client
    .from("events")
    .update(payload)
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { error: "update_failed" };
  }

  if (!data) {
    return { error: "not_found" };
  }

  const event = toLibraryEventDto(data);
  if (!event) {
    return { error: "update_failed" };
  }

  return { event };
}
