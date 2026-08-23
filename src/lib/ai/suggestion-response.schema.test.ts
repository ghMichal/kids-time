import { describe, expect, it } from "vitest";

import { suggestionResponseFromModelSchema, suggestionResponseSchema } from "@/lib/ai/suggestion-response.schema";

const TITLE_100 = "t".repeat(100);
const TITLE_101 = "t".repeat(101);
const SUMMARY_200 = "s".repeat(200);
const SUMMARY_201 = "s".repeat(201);

function validItem(overrides: Record<string, unknown> = {}) {
  return {
    title: "Park visit",
    summary: "Walk around the playground.",
    sourceUrl: "https://example.com/park",
    ...overrides,
  };
}

function productParse(suggestions: unknown[]) {
  return suggestionResponseSchema.safeParse({ suggestions });
}

describe("suggestionResponseSchema", () => {
  it("rejects an empty suggestions array", () => {
    expect(productParse([]).success).toBe(false);
  });

  it("rejects six suggestion items", () => {
    const items = Array.from({ length: 6 }, () => validItem());
    expect(productParse(items).success).toBe(false);
  });

  it("rejects a missing title", () => {
    expect(
      productParse([{ summary: "Walk around the playground.", sourceUrl: "https://example.com/park" }]).success,
    ).toBe(false);
  });

  it("rejects a missing summary", () => {
    expect(productParse([{ title: "Park visit", sourceUrl: "https://example.com/park" }]).success).toBe(false);
  });

  it("rejects a title of 101 characters", () => {
    expect(productParse([validItem({ title: TITLE_101 })]).success).toBe(false);
  });

  it("rejects a summary of 201 characters", () => {
    expect(productParse([validItem({ summary: SUMMARY_201 })]).success).toBe(false);
  });

  it("rejects a sourceUrl that is not a URL", () => {
    expect(productParse([validItem({ sourceUrl: "not-a-url" })]).success).toBe(false);
  });

  it("accepts a single suggestion even though the prompt asks for more", () => {
    const parsed = productParse([validItem({ title: TITLE_100, summary: SUMMARY_200 })]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.suggestions).toHaveLength(1);
  });

  it("omits an empty sourceUrl after normalization", () => {
    const parsed = productParse([validItem({ sourceUrl: "" })]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.suggestions[0]?.sourceUrl).toBeUndefined();
  });

  it("accepts an HTTPS sourceUrl that is not a Wikipedia page", () => {
    const parsed = productParse([validItem({ sourceUrl: "https://example.org/playground" })]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.suggestions[0]?.sourceUrl).toBe("https://example.org/playground");
  });
});

describe("suggestionResponseFromModelSchema two-stage parse", () => {
  it("accepts an over-long title that the product schema then rejects", () => {
    const payload = { suggestions: [validItem({ title: TITLE_101 })] };
    expect(suggestionResponseFromModelSchema.safeParse(payload).success).toBe(true);
    expect(suggestionResponseSchema.safeParse(payload).success).toBe(false);
  });
});
