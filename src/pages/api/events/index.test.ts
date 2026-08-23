import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryEventDto } from "@/lib/events/library-event-dto";

const STUB_EVENT: LibraryEventDto = {
  id: "event-1",
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
};

const { createManualEvent } = vi.hoisted(() => ({
  createManualEvent: vi.fn(),
}));

const { generateEventSummary, generateSuggestions } = vi.hoisted(() => ({
  generateEventSummary: vi.fn(),
  generateSuggestions: vi.fn(),
}));

vi.mock("@/lib/events/create-manual-event", () => ({
  createManualEvent,
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/ai/openrouter-client", () => ({
  generateEventSummary,
  generateSuggestions,
  OpenRouterError: class OpenRouterError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

function createPostRequest(body: unknown = { title: "Park visit" }): Request {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/events", () => {
  beforeEach(() => {
    createManualEvent.mockReset();
    generateEventSummary.mockReset();
    generateSuggestions.mockReset();
    createManualEvent.mockResolvedValue({ event: STUB_EVENT });
  });

  it("creates a manual event without calling generateEventSummary", async () => {
    const { POST } = await import("./index");

    const response = await POST({
      request: createPostRequest(),
      locals: { user: { id: "user-1" } },
      cookies: { set: vi.fn() },
    } as unknown as APIContext);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ event: STUB_EVENT });
    expect(createManualEvent).toHaveBeenCalledOnce();
    expect(generateEventSummary).not.toHaveBeenCalled();
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});
