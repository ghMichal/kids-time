import { describe, expect, it } from "vitest";

import {
  eventSummaryResponseFromModelSchema,
  eventSummaryResponseSchema,
} from "@/lib/ai/event-summary-response.schema";

const SUMMARY_200 = "s".repeat(200);
const SUMMARY_201 = "s".repeat(201);

describe("eventSummaryResponseSchema", () => {
  it("rejects a missing summary", () => {
    expect(eventSummaryResponseSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string summary", () => {
    expect(eventSummaryResponseSchema.safeParse({ summary: 12 }).success).toBe(false);
    expect(eventSummaryResponseSchema.safeParse({ summary: null }).success).toBe(false);
  });

  it("rejects an empty summary", () => {
    expect(eventSummaryResponseSchema.safeParse({ summary: "" }).success).toBe(false);
  });

  it("rejects a whitespace-only summary after trim", () => {
    expect(eventSummaryResponseSchema.safeParse({ summary: "   \n\t  " }).success).toBe(false);
  });

  it("rejects a summary of 201 characters", () => {
    expect(eventSummaryResponseSchema.safeParse({ summary: SUMMARY_201 }).success).toBe(false);
  });

  it("accepts a 1-character summary after trim", () => {
    const parsed = eventSummaryResponseSchema.safeParse({ summary: "  a  " });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBe("a");
  });

  it("accepts a 200-character summary", () => {
    const parsed = eventSummaryResponseSchema.safeParse({ summary: SUMMARY_200 });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBe(SUMMARY_200);
    expect(parsed.data.summary).toHaveLength(200);
  });

  it("trims leading and trailing space", () => {
    const parsed = eventSummaryResponseSchema.safeParse({ summary: "  short walk  " });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBe("short walk");
  });
});

describe("eventSummaryResponseFromModelSchema two-stage parse", () => {
  it("accepts a raw over-long string that the product schema then rejects", () => {
    const payload = { summary: SUMMARY_201 };
    expect(eventSummaryResponseFromModelSchema.safeParse(payload).success).toBe(true);
    expect(eventSummaryResponseSchema.safeParse(payload).success).toBe(false);
  });
});
