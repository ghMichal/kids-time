import { describe, expect, it } from "vitest";

import { manualEventCreateSchema } from "@/lib/events/manual-event-create.schema";

const BASE = { title: "Park visit" };

describe("manualEventCreateSchema", () => {
  it("accepts omitted summary", () => {
    const parsed = manualEventCreateSchema.safeParse(BASE);
    expect(parsed.success).toBe(true);
  });

  it("accepts null summary", () => {
    const parsed = manualEventCreateSchema.safeParse({ ...BASE, summary: null });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBeNull();
  });

  it("accepts empty string summary and normalizes to null", () => {
    const parsed = manualEventCreateSchema.safeParse({ ...BASE, summary: "" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBeNull();
  });

  it("accepts whitespace-only summary and normalizes to null", () => {
    const parsed = manualEventCreateSchema.safeParse({ ...BASE, summary: "   \t  " });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.summary).toBeNull();
  });
});
