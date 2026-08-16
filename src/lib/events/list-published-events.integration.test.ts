import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listPublishedEvents } from "@/lib/events/list-published-events";
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
    `[integration] skipping listPublishedEvents privacy: missing env (${missing}). See src/lib/events/__test__/README.md`,
  );
}

interface Seeded {
  client: SupabaseClient<Database>;
  id: string;
}

describe.skipIf(!hasIntegrationEnv())("listPublishedEvents privacy (integration)", () => {
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

  it("hides A's unpublished from B's shared list and shows A's published (positive control)", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const unpublishedAId = await seedEvent(a, {
      title: "A unpublished private",
      triage_status: "accepted",
      is_published: false,
      published_at: null,
    });
    const publishedAId = await seedEvent(a, {
      title: "A published shared",
      triage_status: "accepted",
      is_published: true,
      published_at: new Date().toISOString(),
    });

    const result = await listPublishedEvents(b.client, b.userId);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;

    const ids = result.events.map((event) => event.id);
    expect(ids).not.toContain(unpublishedAId);
    expect(ids).toContain(publishedAId);
  });

  it("raw RLS probe: unpublished A is invisible to JWT B SELECT", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const unpublishedAId = await seedEvent(a, {
      title: "A unpublished for RLS probe",
      triage_status: "accepted",
      is_published: false,
      published_at: null,
    });

    const { data, error } = await b.client.from("events").select("id").eq("id", unpublishedAId).maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("excludes A's own published from A's shared list (self-exclude .neq)", async () => {
    if (!a) throw new Error("JWT client A not initialized");

    const ownPublishedId = await seedEvent(a, {
      title: "A own published self-exclude",
      triage_status: "accepted",
      is_published: true,
      published_at: new Date().toISOString(),
    });

    const result = await listPublishedEvents(a.client, a.userId);

    expect(result).not.toHaveProperty("error");
    if ("error" in result) return;

    const ids = result.events.map((event) => event.id);
    expect(ids).not.toContain(ownPublishedId);
  });
});
