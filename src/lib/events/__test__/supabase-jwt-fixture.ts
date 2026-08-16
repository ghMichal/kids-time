import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "USER_A_EMAIL",
  "USER_A_PASSWORD",
  "USER_A_ID",
  "USER_B_EMAIL",
  "USER_B_PASSWORD",
  "USER_B_ID",
] as const;

type RequiredEnvName = (typeof REQUIRED_ENV)[number];

/** Fill missing process.env keys from local secret files (never overrides shell). */
function hydrateEnvFromLocalFiles(): void {
  for (const file of [".env", ".dev.vars"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] ??= value;
    }
  }
}

hydrateEnvFromLocalFiles();

export function hasIntegrationEnv(): boolean {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]?.trim()));
}

export function missingIntegrationEnvKeys(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

function requireEnv(name: RequiredEnvName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export interface JwtUserClient {
  client: SupabaseClient<Database>;
  userId: string;
  email: string;
}

async function createUserClient(email: string, password: string, expectedUserId: string): Promise<JwtUserClient> {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_KEY");

  const client = createClient<Database>(url, key);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signIn failed for ${email}: ${error.message}`);
  }
  if (data.user.id !== expectedUserId) {
    throw new Error(`user id mismatch for ${email}: expected ${expectedUserId}, got ${data.user.id}`);
  }

  return { client, userId: data.user.id, email };
}

/** Two JWT clients (A/B) via anon key + password grant — not SSR supabase helper. */
export async function createJwtClientsAB(): Promise<{ a: JwtUserClient; b: JwtUserClient }> {
  const a = await createUserClient(requireEnv("USER_A_EMAIL"), requireEnv("USER_A_PASSWORD"), requireEnv("USER_A_ID"));
  const b = await createUserClient(requireEnv("USER_B_EMAIL"), requireEnv("USER_B_PASSWORD"), requireEnv("USER_B_ID"));
  return { a, b };
}

export async function wipeOwnEvents(client: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { error } = await client.from("events").delete().eq("owner_id", ownerId);
  if (error) {
    throw new Error(`wipeOwnEvents failed for ${ownerId}: ${error.message}`);
  }
}
