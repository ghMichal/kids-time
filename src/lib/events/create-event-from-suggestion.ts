import type { SupabaseClient } from "@supabase/supabase-js";
import type { TriageRequest } from "@/lib/events/triage-request.schema";
import type { Database, TablesInsert } from "@/types";

export type CreateEventFromSuggestionInput = TriageRequest & {
  ownerId: string;
};

export interface TriageEventDto {
  id: string;
  triage_status: "accepted" | "rejected" | "maybe";
  title: string;
}

function mapLocationKind(
  indoorOutdoor: CreateEventFromSuggestionInput["criteria"]["indoorOutdoor"],
): TablesInsert<"events">["location_kind"] {
  if (indoorOutdoor === "either") {
    return null;
  }
  return indoorOutdoor;
}

export function mapSuggestionToEventInsert(input: CreateEventFromSuggestionInput): TablesInsert<"events"> {
  const { ownerId, triageStatus, suggestion, criteria } = input;

  return {
    owner_id: ownerId,
    title: suggestion.title,
    summary: suggestion.summary,
    source_url: suggestion.sourceUrl ?? null,
    image_path: null,
    place: criteria.place,
    starts_at: null,
    description: `Czas: ${criteria.time}`,
    child_age_years: criteria.childAge,
    location_kind: mapLocationKind(criteria.indoorOutdoor),
    origin: "ai_suggested",
    triage_status: triageStatus,
    is_published: false,
  };
}

export async function createEventFromSuggestion(
  client: SupabaseClient<Database>,
  input: CreateEventFromSuggestionInput,
): Promise<{ event: TriageEventDto } | { error: "insert_failed" }> {
  const payload = mapSuggestionToEventInsert(input);

  const { data, error } = await client.from("events").insert(payload).select("id, triage_status, title").single();

  if (error) {
    return { error: "insert_failed" };
  }

  const triageStatus = data.triage_status;
  if (triageStatus !== "accepted" && triageStatus !== "rejected" && triageStatus !== "maybe") {
    return { error: "insert_failed" };
  }

  return {
    event: {
      id: data.id,
      triage_status: triageStatus,
      title: data.title,
    },
  };
}
