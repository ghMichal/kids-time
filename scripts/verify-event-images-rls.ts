/* eslint-disable no-console -- manual RLS verification for F-04 phase 1 */
/**
 * Manual RLS check: owner upload/read OK; non-owner denied.
 * Usage (set env vars first):
 *   npx tsx scripts/verify-event-images-rls.ts
 */
import { createClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return value;
}

const url = required("SUPABASE_URL");
const key = required("SUPABASE_KEY");
const userAEmail = required("USER_A_EMAIL");
const userAPassword = required("USER_A_PASSWORD");
const userAId = required("USER_A_ID");
const userBEmail = required("USER_B_EMAIL");
const userBPassword = required("USER_B_PASSWORD");
const eventId = process.env.EVENT_ID ?? "00000000-0000-4000-8000-000000000001";

const pathA = `${userAId}/${eventId}/test.jpg`;
const pathIntruder = `${userAId}/${eventId}/intruder.jpg`;

const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83,
  222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 18, 221, 141, 180, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
]);

async function login(email: string, password: string) {
  const client = createClient(url, key);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`${email}: ${error.message}`);
  }
  return client;
}

async function main(): Promise<void> {
  console.log("--- User A: upload own path (expect OK) ---");
  const a = await login(userAEmail, userAPassword);
  const upA = await a.storage.from("event-images").upload(pathA, png, {
    contentType: "image/png",
    upsert: true,
  });
  console.log(upA.error ? `FAIL: ${upA.error.message}` : "OK");

  console.log("--- User A: download own file (expect OK) ---");
  const dlA = await a.storage.from("event-images").download(pathA);
  console.log(dlA.error ? `FAIL: ${dlA.error.message}` : "OK");

  console.log("--- User B: upload to User A folder (expect RLS deny) ---");
  const b = await login(userBEmail, userBPassword);
  const upB = await b.storage.from("event-images").upload(pathIntruder, png, {
    contentType: "image/png",
  });
  console.log(upB.error ? `OK (denied): ${upB.error.message}` : "FAIL: upload should be denied");

  console.log("--- User B: download User A file (expect deny) ---");
  const dlB = await b.storage.from("event-images").download(pathA);
  console.log(dlB.error ? `OK (denied): ${dlB.error.message}` : "FAIL: download should be denied");

  await a.auth.signOut();
  await b.auth.signOut();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
