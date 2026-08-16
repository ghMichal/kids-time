import { describe, expect, it } from "vitest";

/**
 * Bootstrap-only placeholder so the integration project has a file until Phase 4.
 * Must not run under `npm test` (unit project excludes `*.integration.test.ts`).
 */
describe("vitest integration smoke", () => {
  it("starts the integration project without requiring Supabase env", () => {
    expect(true).toBe(true);
  });
});
