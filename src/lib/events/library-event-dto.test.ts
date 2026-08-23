import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toLibraryEventDto, type LibraryEventRow } from "@/lib/events/library-event-dto";
import type { Database } from "@/types";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PATH_A = `${OWNER_A}/${EVENT_ID}/photo.jpg`;
const SIGNED_URL = "https://example.test/signed/event-image";

const { createEventImageSignedUrl } = vi.hoisted(() => ({
  createEventImageSignedUrl: vi.fn(),
}));

vi.mock("@/lib/storage/event-image", () => ({
  createEventImageSignedUrl,
}));

const client = {} as unknown as SupabaseClient<Database>;

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
    image_path: null,
    ...overrides,
  };
}

describe("toLibraryEventDto image mapping", () => {
  beforeEach(() => {
    createEventImageSignedUrl.mockReset();
  });

  it("maps null image_path to imageUrl null without calling sign", async () => {
    const row = libraryRow({ image_path: null });

    const dto = await toLibraryEventDto(client, OWNER_A, row);

    expect(dto).not.toBeNull();
    expect(dto?.imageUrl).toBeNull();
    expect(createEventImageSignedUrl).not.toHaveBeenCalled();
  });

  it("maps path + sign fail to imageUrl null and keeps other fields", async () => {
    createEventImageSignedUrl.mockResolvedValue(null);

    const row = libraryRow({
      title: "Museum workshop",
      summary: "Clay pots",
      description: "Hands-on",
      place: "City Museum",
      child_age_years: 7,
      location_kind: "indoor",
      source_url: "https://example.test/museum",
      triage_status: "maybe",
      updated_at: "2026-08-01T12:00:00.000Z",
      is_published: true,
      published_at: "2026-08-01T13:00:00.000Z",
      image_path: PATH_A,
    });

    const dto = await toLibraryEventDto(client, OWNER_A, row);

    expect(dto).toEqual({
      id: EVENT_ID,
      title: "Museum workshop",
      summary: "Clay pots",
      description: "Hands-on",
      place: "City Museum",
      child_age_years: 7,
      location_kind: "indoor",
      source_url: "https://example.test/museum",
      triage_status: "maybe",
      updated_at: "2026-08-01T12:00:00.000Z",
      is_published: true,
      published_at: "2026-08-01T13:00:00.000Z",
      imageUrl: null,
    });
    expect(createEventImageSignedUrl).toHaveBeenCalledOnce();
    expect(createEventImageSignedUrl).toHaveBeenCalledWith(client, PATH_A, OWNER_A);
  });

  it("maps path + sign URL to that imageUrl", async () => {
    createEventImageSignedUrl.mockResolvedValue(SIGNED_URL);

    const row = libraryRow({ image_path: PATH_A });
    const dto = await toLibraryEventDto(client, OWNER_A, row);

    expect(dto?.imageUrl).toBe(SIGNED_URL);
    expect(createEventImageSignedUrl).toHaveBeenCalledOnce();
    expect(createEventImageSignedUrl).toHaveBeenCalledWith(client, PATH_A, OWNER_A);
  });
});
