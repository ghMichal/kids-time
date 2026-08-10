import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_EVENT_SELECT_COLUMNS, toLibraryEventDto, type LibraryEventDto } from "@/lib/events/library-event-dto";
import type { Database } from "@/types";

export type { LibraryEventDto } from "@/lib/events/library-event-dto";

export async function listOwnLibraryEvents(
  client: SupabaseClient<Database>,
  ownerId: string,
): Promise<{ events: LibraryEventDto[] } | { error: "list_failed" }> {
  const { data, error } = await client
    .from("events")
    .select(LIBRARY_EVENT_SELECT_COLUMNS)
    .eq("owner_id", ownerId)
    .in("triage_status", ["accepted", "maybe"])
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: "list_failed" };
  }

  const mapped = await Promise.all(data.map((row) => toLibraryEventDto(client, ownerId, row)));
  const events = mapped.filter((dto): dto is LibraryEventDto => dto !== null);

  return { events };
}
