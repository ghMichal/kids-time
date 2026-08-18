import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publishOwnEvent } from "@/lib/events/publish-own-event";
import {
  createJwtClientsAB,
  hasIntegrationEnv,
  missingIntegrationEnvKeys,
  wipeOwnEvents,
  type JwtUserClient,
} from "@/lib/events/__test__/supabase-jwt-fixture";
import type { Database, TablesInsert } from "@/types";

if (!hasIntegrationEnv()) {
  const missing = missingIntegrationEnvKeys().join(", ");
  // eslint-disable-next-line no-console -- skip reason must be visible when env is absent
  console.info(
    `[integration] skipping publishOwnEvent IDOR: missing env (${missing}). See src/lib/events/__test__/README.md`,
  );
}

interface Seeded {
  client: SupabaseClient<Database>;
  id: string;
}

describe.skipIf(!hasIntegrationEnv())("publishOwnEvent IDOR (integration)", () => {
  let a: JwtUserClient | undefined;
  let b: JwtUserClient | undefined;
  const seeded: Seeded[] = [];

  beforeAll(async () => {
    ({ a, b } = await createJwtClientsAB());
    await wipeOwnEvents(a.client, a.userId);
    await wipeOwnEvents(b.client, b.userId);
  }, 30_000);

  beforeEach(async () => {
    if (!a || !b) {
      throw new Error("JWT clients not initialized");
    }
    await wipeOwnEvents(a.client, a.userId);
    await wipeOwnEvents(b.client, b.userId);
    seeded.length = 0;
  });

  afterEach(async () => {
    for (const row of [...seeded].reverse()) {
      const { error } = await row.client.from("events").delete().eq("id", row.id);
      if (error) {
        throw new Error(`cleanup delete failed for ${row.id}: ${error.message}`);
      }
    }
    seeded.length = 0;
  });

  afterAll(async () => {
    if (!a || !b) return;
    await wipeOwnEvents(a.client, a.userId);
    await wipeOwnEvents(b.client, b.userId);
    await a.client.auth.signOut();
    await b.client.auth.signOut();
  });

  async function seedEvent(
    user: JwtUserClient,
    patch: Partial<TablesInsert<"events">> & Pick<TablesInsert<"events">, "title" | "triage_status">,
  ): Promise<string> {
    const payload: TablesInsert<"events"> = {
      owner_id: user.userId,
      title: patch.title,
      triage_status: patch.triage_status,
      origin: "manual",
      summary: patch.summary ?? null,
      description: patch.description ?? null,
      place: patch.place ?? null,
      child_age_years: patch.child_age_years ?? null,
      location_kind: patch.location_kind ?? null,
      image_path: null,
      starts_at: null,
      source_url: null,
      is_published: patch.is_published ?? false,
      published_at: patch.published_at ?? null,
    };

    const { data, error } = await user.client.from("events").insert(payload).select("id").single();
    if (error) {
      throw new Error(`seedEvent failed: ${error.message}`);
    }

    seeded.push({ client: user.client, id: data.id });
    return data.id;
  }

  it("returns not_found when A publishes B's unpublished event (no event body)", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const foreignId = await seedEvent(b, {
      title: "B unpublished publish target",
      triage_status: "accepted",
      is_published: false,
      published_at: null,
    });

    const before = await b.client
      .from("events")
      .select("id, is_published, published_at")
      .eq("id", foreignId)
      .maybeSingle();
    expect(before.error).toBeNull();
    expect(before.data).toEqual({
      id: foreignId,
      is_published: false,
      published_at: null,
    });

    const result = await publishOwnEvent(a.client, a.userId, foreignId);

    expect(result).toEqual({ error: "not_found" });
    expect(result).not.toHaveProperty("event");

    const after = await b.client
      .from("events")
      .select("id, is_published, published_at")
      .eq("id", foreignId)
      .maybeSingle();

    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("returns not_found when A publishes B's already-published event (not already_published)", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const foreignId = await seedEvent(b, {
      title: "B already published",
      triage_status: "accepted",
      is_published: true,
      published_at: new Date().toISOString(),
    });

    const before = await b.client
      .from("events")
      .select("id, is_published, published_at")
      .eq("id", foreignId)
      .maybeSingle();
    expect(before.error).toBeNull();
    expect(before.data?.is_published).toBe(true);
    expect(before.data?.published_at).not.toBeNull();

    const result = await publishOwnEvent(a.client, a.userId, foreignId);

    expect(result).toEqual({ error: "not_found" });
    expect(result).not.toHaveProperty("event");

    const after = await b.client
      .from("events")
      .select("id, is_published, published_at")
      .eq("id", foreignId)
      .maybeSingle();

    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });
});
