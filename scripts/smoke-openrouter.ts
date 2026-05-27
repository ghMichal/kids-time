/* eslint-disable no-console -- CLI smoke script */
/**
 * Smoke test: OpenRouter + lib/ai prompt/schemas (no Astro server, no auth).
 * Usage: npx tsx scripts/smoke-openrouter.ts
 * Reads OPENROUTER_* from .dev.vars (or process.env).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSuggestionPrompt } from "../src/lib/ai/build-suggestion-prompt.ts";
import type { SuggestionRequest } from "../src/lib/ai/suggestion-request.schema.ts";
import {
  openRouterResponseFormat,
  suggestionResponseFromModelSchema,
  suggestionResponseSchema,
} from "../src/lib/ai/suggestion-response.schema.ts";

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

const criteria: SuggestionRequest = {
  place: "Kraków",
  time: "niedziela popołudnie",
  childAge: 6,
  indoorOutdoor: "outdoor",
};

async function main(): Promise<void> {
  const fromFile = loadDevVars(DEV_VARS_PATH);
  const apiKey = process.env.OPENROUTER_API_KEY ?? fromFile.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? fromFile.OPENROUTER_MODEL;

  if (!apiKey || !model) {
    console.error("Missing OPENROUTER_API_KEY or OPENROUTER_MODEL in .dev.vars");
    process.exit(1);
  }

  const { messages } = buildSuggestionPrompt(criteria);
  const started = Date.now();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://kids-time.app",
      "X-Title": "kids-time-smoke",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      response_format: openRouterResponseFormat,
      provider: { require_parameters: true },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const elapsedMs = Date.now() - started;
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (!response.ok) {
    console.error(`FAIL HTTP ${response.status} (${elapsedMs}ms):`, payload.error?.message ?? "unknown");
    process.exit(1);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`FAIL empty content (${elapsedMs}ms)`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    console.error(`FAIL invalid JSON in content (${elapsedMs}ms)`);
    process.exit(1);
  }

  const fromModel = suggestionResponseFromModelSchema.safeParse(parsed);
  if (!fromModel.success) {
    console.error(`FAIL shape (${elapsedMs}ms):`, fromModel.error.issues);
    process.exit(1);
  }

  const normalized = suggestionResponseSchema.safeParse(fromModel.data);
  if (!normalized.success) {
    console.error(`FAIL validation (${elapsedMs}ms):`, normalized.error.issues);
    process.exit(1);
  }

  const { suggestions } = normalized.data;
  console.log(`OK (${elapsedMs}ms) — ${suggestions.length} suggestion(s), model=${model}`);
  for (const [i, s] of suggestions.entries()) {
    console.log(`  ${i + 1}. ${s.title}`);
    console.log(`     ${s.summary}`);
    if (s.sourceUrl) console.log(`     ${s.sourceUrl}`);
  }
}

main().catch((error: unknown) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
