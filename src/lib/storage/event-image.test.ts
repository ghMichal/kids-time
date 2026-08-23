import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { EVENT_IMAGE_SIGNED_URL_TTL_SECONDS, createEventImageSignedUrl } from "@/lib/storage/event-image";
import { EVENT_IMAGES_BUCKET } from "@/lib/storage/constants";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const PATH_A = `${OWNER_A}/${EVENT_ID}/photo.jpg`;

interface SignedUrlResult {
  data: { signedUrl?: string } | null;
  error: { message: string } | null;
}

function createStorageMock(createSignedUrlImpl: () => SignedUrlResult) {
  const createSignedUrl = vi.fn(() => Promise.resolve(createSignedUrlImpl()));
  const from = vi.fn((bucket: string) => {
    expect(bucket).toBe(EVENT_IMAGES_BUCKET);
    return { createSignedUrl };
  });

  return {
    client: { storage: { from } } as unknown as SupabaseClient,
    createSignedUrl,
    from,
  };
}

describe("createEventImageSignedUrl", () => {
  it("returns null on owner mismatch without calling createSignedUrl", async () => {
    const { client, createSignedUrl } = createStorageMock(() => ({
      data: { signedUrl: "https://example.com/should-not-run" },
      error: null,
    }));

    const result = await createEventImageSignedUrl(client, PATH_A, OWNER_B);

    expect(result).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns null when Storage returns an error", async () => {
    const { client, createSignedUrl } = createStorageMock(() => ({
      data: null,
      error: { message: "storage unavailable" },
    }));

    const result = await createEventImageSignedUrl(client, PATH_A, OWNER_A);

    expect(result).toBeNull();
    expect(createSignedUrl).toHaveBeenCalledWith(PATH_A, EVENT_IMAGE_SIGNED_URL_TTL_SECONDS);
  });

  it("returns null when signedUrl is missing from data", async () => {
    const { client } = createStorageMock(() => ({
      data: {},
      error: null,
    }));

    const result = await createEventImageSignedUrl(client, PATH_A, OWNER_A);

    expect(result).toBeNull();
  });

  it("returns null when signedUrl is an empty string", async () => {
    const { client } = createStorageMock(() => ({
      data: { signedUrl: "" },
      error: null,
    }));

    const result = await createEventImageSignedUrl(client, PATH_A, OWNER_A);

    expect(result).toBeNull();
  });

  it("returns the signed URL string on success", async () => {
    const signedUrl = "https://example.com/storage/v1/object/sign/event-images/photo.jpg?token=abc";
    const { client, createSignedUrl } = createStorageMock(() => ({
      data: { signedUrl },
      error: null,
    }));

    const result = await createEventImageSignedUrl(client, PATH_A, OWNER_A);

    expect(result).toBe(signedUrl);
    expect(createSignedUrl).toHaveBeenCalledWith(PATH_A, EVENT_IMAGE_SIGNED_URL_TTL_SECONDS);
  });
});
