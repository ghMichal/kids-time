import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { uploadOwnEventImage } from "@/lib/events/upload-own-event-image";
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
    `[integration] skipping uploadOwnEventImage IDOR: missing env (${missing}). See src/lib/events/__test__/README.md`,
  );
}

interface Seeded {
  client: SupabaseClient<Database>;
  id: string;
}

describe.skipIf(!hasIntegrationEnv())("uploadOwnEventImage IDOR (integration)", () => {
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
      image_path: patch.image_path ?? null,
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

  it("returns not_found when A uploads onto B's event (no imagePath; row unchanged)", async () => {
    if (!a || !b) throw new Error("JWT clients not initialized");

    const foreignId = await seedEvent(b, {
      title: "B image upload target",
      triage_status: "accepted",
      image_path: null,
    });

    const before = await b.client.from("events").select("id, image_path").eq("id", foreignId).maybeSingle();
    expect(before.error).toBeNull();
    expect(before.data).toEqual({ id: foreignId, image_path: null });

    // Owner select in uploadOwnEventImage returns not_found before Storage I/O;
    // dummy Blob satisfies the Blob type. Do not assert bucket/folder RLS here.
    const result = await uploadOwnEventImage(a.client, {
      ownerId: a.userId,
      eventId: foreignId,
      file: new Blob([]),
    });

    expect(result).toEqual({ error: "not_found" });
    expect(result).not.toHaveProperty("imagePath");

    const after = await b.client.from("events").select("id, image_path").eq("id", foreignId).maybeSingle();

    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });
});
