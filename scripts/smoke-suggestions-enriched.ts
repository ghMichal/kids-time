/* eslint-disable no-console -- CLI smoke script */
/**
 * Smoke test: OG enricher only (no Astro, no auth, no OpenRouter).
 * Usage: npx tsx scripts/smoke-suggestions-enriched.ts
 */
import type { SuggestionItem } from "../src/lib/ai/suggestion-response.schema.ts";
import { enrichSuggestionImages } from "../src/lib/suggestions/enrich-suggestion-images.ts";

const MOCK_ITEMS: SuggestionItem[] = [
  {
    title: "Wikipedia (expect OG image)",
    summary: "Page known to expose og:image meta.",
    sourceUrl: "https://pl.wikipedia.org/wiki/Park_Jordana",
  },
  {
    title: "No source URL (expect text-only)",
    summary: "Enricher must leave imageUrl unset.",
  },
];

async function main(): Promise<void> {
  const started = Date.now();
  const enriched = await enrichSuggestionImages(MOCK_ITEMS);
  const elapsedMs = Date.now() - started;

  if (enriched.length !== 2) {
    console.error(`FAIL (${elapsedMs}ms): expected 2 items, got ${enriched.length}`);
    process.exit(1);
  }

  const withImage = enriched[0];
  const withoutImage = enriched[1];

  if (!withImage.imageUrl) {
    console.error(`FAIL (${elapsedMs}ms): expected imageUrl for Wikipedia source`);
    console.error(withImage);
    process.exit(1);
  }

  if (withoutImage.imageUrl) {
    console.error(`FAIL (${elapsedMs}ms): unexpected imageUrl when sourceUrl is missing`);
    console.error(withoutImage);
    process.exit(1);
  }

  console.log(`OK (${elapsedMs}ms) — ${enriched.length} item(s)`);
  console.log(`  1. ${withImage.title}`);
  console.log(`     imageUrl=${withImage.imageUrl}`);
  console.log(`  2. ${withoutImage.title}`);
  console.log("     imageUrl=(none)");
}

main().catch((error: unknown) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
