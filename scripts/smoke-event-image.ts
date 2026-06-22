/* eslint-disable no-console -- CLI smoke script */
/**
 * Smoke test: event image storage helpers + Supabase JWT client.
 * Usage: npx tsx scripts/smoke-event-image.ts
 * Reads SUPABASE_* and SMOKE_TEST_* from .dev.vars (or process.env).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { EVENT_IMAGES_BUCKET } from "../src/lib/storage/constants.ts";
import { EventImageError, removeEventImage, uploadEventImage } from "../src/lib/storage/event-image.ts";

const DEV_VARS_PATH = resolve(process.cwd(), ".dev.vars");

function loadDevVars(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const PNG_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83,
  222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 18, 221, 141, 180, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
]);

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const fromFile = loadDevVars(DEV_VARS_PATH);
  const url = process.env.SUPABASE_URL ?? fromFile.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY ?? fromFile.SUPABASE_KEY;
  const email = process.env.SMOKE_TEST_EMAIL ?? fromFile.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD ?? fromFile.SMOKE_TEST_PASSWORD;

  if (!url || !key || !email || !password) {
    fail("Missing SUPABASE_URL, SUPABASE_KEY, SMOKE_TEST_EMAIL, or SMOKE_TEST_PASSWORD");
  }

  const client = createClient(url, key);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    fail(`sign in: ${signInError.message}`);
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    fail("could not read authenticated user");
  }

  const eventId = process.env.EVENT_ID ?? randomUUID();
  const file = new Blob([PNG_BYTES], { type: "image/png" });

  let path: string;
  try {
    const uploaded = await uploadEventImage(client, {
      ownerId: user.id,
      eventId,
      file,
      filename: "smoke.png",
    });
    path = uploaded.path;
    console.log(`upload OK — ${path}`);
  } catch (error) {
    if (error instanceof EventImageError) {
      fail(`upload: ${error.message}`);
    }
    throw error;
  }

  const { error: downloadError } = await client.storage.from(EVENT_IMAGES_BUCKET).download(path);
  if (downloadError) {
    fail(`download: ${downloadError.message}`);
  }
  console.log("download OK");

  try {
    await removeEventImage(client, path, user.id);
    console.log("remove OK");
  } catch (error) {
    if (error instanceof EventImageError) {
      fail(`remove: ${error.message}`);
    }
    throw error;
  }

  await client.auth.signOut();
  console.log("OK — smoke-event-image passed");
}

main().catch((error: unknown) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
