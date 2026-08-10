import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventUpdateRequest } from "@/lib/events/event-update.schema";
import { LIBRARY_EVENT_SELECT_COLUMNS, toLibraryEventDto, type LibraryEventDto } from "@/lib/events/library-event-dto";
import type { Database, TablesUpdate } from "@/types";

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
    .select(LIBRARY_EVENT_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return { error: "update_failed" };
  }

  if (!data) {
    return { error: "not_found" };
  }

  const event = await toLibraryEventDto(client, ownerId, data);
  if (!event) {
    return { error: "update_failed" };
  }

  return { event };
}
