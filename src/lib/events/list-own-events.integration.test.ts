import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listOwnLibraryEvents } from "@/lib/events/list-own-events";
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
    `[integration] skipping listOwnLibraryEvents: missing env (${missing}). See src/lib/events/__test__/README.md`,
  );
}

interface Seeded {
  client: SupabaseClient<Database>;
  id: string;
}

describe.skipIf(!hasIntegrationEnv())("listOwnLibraryEvents (integration)", () => {
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
      await row.client.from("events").delete().eq("id", row.id);
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

  it("returns only owner A's accepted and maybe events", async () => {
    if (!a) throw new Error("JWT client A not initialized");

    const acceptedId = await seedEvent(a, { title: "A accepted", triage_status: "accepted" });
    const maybeId = await seedEvent(a, { title: "A maybe", triage_status: "maybe" });
    await seedEvent(a, { title: "A rejected", triage_status: "rejected" });

    const result = await listOwnLibraryEvents(a.client, a.userId);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;

    const ids = result.events.map((event) => event.id);
    expect(ids).toEqual(expect.arrayContaining([acceptedId, maybeId]));
    expect(ids).toHaveLength(2);
    for (const event of result.events) {
      expect(["accepted", "maybe"]).toContain(event.triage_status);
    }
  });

  it("returns empty events when A has no accepted/maybe rows", async () => {
    if (!a) throw new Error("JWT client A not initialized");

    await seedEvent(a, { title: "A rejected only", triage_status: "rejected" });

    const result = await listOwnLibraryEvents(a.client, a.userId);

    expect(result).toEqual({ events: [] });
  });

  it("does not include B's published accepted event on A's library list", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const foreignPublishedId = await seedEvent(b, {
      title: "B published accepted",
      triage_status: "accepted",
      is_published: true,
      published_at: new Date().toISOString(),
    });
    const ownId = await seedEvent(a, { title: "A own accepted", triage_status: "accepted" });

    const result = await listOwnLibraryEvents(a.client, a.userId);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;

    const ids = result.events.map((event) => event.id);
    expect(ids).toContain(ownId);
    expect(ids).not.toContain(foreignPublishedId);
  });
});
