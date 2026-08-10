import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_EVENT_SELECT_COLUMNS, toLibraryEventDto, type LibraryEventDto } from "@/lib/events/library-event-dto";
import type { ManualEventCreateRequest } from "@/lib/events/manual-event-create.schema";
import type { Database, TablesInsert } from "@/types";

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

export async function createManualEvent(
  client: SupabaseClient<Database>,
  input: CreateManualEventInput,
): Promise<{ event: LibraryEventDto } | { error: "insert_failed" }> {
  const payload = mapManualEventInsert(input);

  const { data, error } = await client.from("events").insert(payload).select(LIBRARY_EVENT_SELECT_COLUMNS).single();

  if (error) {
    return { error: "insert_failed" };
  }

  const event = await toLibraryEventDto(client, input.ownerId, data);
  if (!event) {
    return { error: "insert_failed" };
  }

  return { event };
}
