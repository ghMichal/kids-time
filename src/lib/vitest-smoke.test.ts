import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/route-access";

describe("vitest smoke", () => {
  it("resolves the @/ path alias and runs under the unit project", () => {
    expect(isPublicPath("/")).toBe(true);
  });
});
