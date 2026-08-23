import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIBRARY_EVENT_SELECT_COLUMNS, type LibraryEventRow } from "@/lib/events/library-event-dto";
import { listOwnLibraryEvents } from "@/lib/events/list-own-events";
import type { Database } from "@/types";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PATH_A = `${OWNER_A}/${EVENT_ID}/photo.jpg`;

const { createEventImageSignedUrl } = vi.hoisted(() => ({
  createEventImageSignedUrl: vi.fn(),
}));

vi.mock("@/lib/storage/event-image", () => ({
  createEventImageSignedUrl,
}));

interface QueryResult {
  data: LibraryEventRow[] | null;
  error: { message: string } | null;
}

function libraryRow(overrides: Partial<LibraryEventRow> = {}): LibraryEventRow {
  return {
    id: EVENT_ID,
    title: "Park visit",
    summary: null,
    description: null,
    place: null,
    child_age_years: null,
    location_kind: null,
    source_url: null,
    triage_status: "accepted",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_published: false,
    published_at: null,
    image_path: PATH_A,
    ...overrides,
  };
}

function createEventsQueryClient(result: QueryResult) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then(onFulfilled?: ((value: QueryResult) => unknown) | null, onRejected?: ((reason: unknown) => unknown) | null) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  const from = vi.fn((table: string) => {
    expect(table).toBe("events");
    return builder;
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    builder,
    from,
  };
}

describe("listOwnLibraryEvents sign soft-fail", () => {
  beforeEach(() => {
    createEventImageSignedUrl.mockReset();
  });

  it("returns events with imageUrl null when sign fails", async () => {
    createEventImageSignedUrl.mockResolvedValue(null);
    const row = libraryRow();
    const { client, builder } = createEventsQueryClient({ data: [row], error: null });

    const result = await listOwnLibraryEvents(client, OWNER_A);

    expect(builder.select).toHaveBeenCalledWith(LIBRARY_EVENT_SELECT_COLUMNS);
    expect(builder.eq).toHaveBeenCalledWith("owner_id", OWNER_A);
    expect(builder.in).toHaveBeenCalledWith("triage_status", ["accepted", "maybe"]);
    expect(builder.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(createEventImageSignedUrl).toHaveBeenCalledWith(client, PATH_A, OWNER_A);
    expect(result).not.toHaveProperty("error");
    expect(result).toEqual({
      events: [
        {
          id: EVENT_ID,
          title: "Park visit",
          summary: null,
          description: null,
          place: null,
          child_age_years: null,
          location_kind: null,
          source_url: null,
          triage_status: "accepted",
          updated_at: "2026-01-01T00:00:00.000Z",
          is_published: false,
          published_at: null,
          imageUrl: null,
        },
      ],
    });
  });

  it("returns list_failed on DB error, distinct from sign soft-fail", async () => {
    const { client } = createEventsQueryClient({ data: null, error: { message: "db" } });

    const result = await listOwnLibraryEvents(client, OWNER_A);

    expect(result).toEqual({ error: "list_failed" });
    expect(createEventImageSignedUrl).not.toHaveBeenCalled();
  });
});
