import { describe, expect, it } from "vitest";

import { decideUnauthenticatedAccess } from "@/lib/unauthenticated-api-guard";

describe("decideUnauthenticatedAccess", () => {
  it("returns json_401 for protected /api/* routes", () => {
    expect(decideUnauthenticatedAccess("/api/events")).toEqual({ type: "json_401" });
    expect(decideUnauthenticatedAccess("/api/ai/suggestions")).toEqual({ type: "json_401" });
  });

  it("allows /api/auth without a 401 JSON response", () => {
    expect(decideUnauthenticatedAccess("/api/auth")).toEqual({ type: "allow" });
    expect(decideUnauthenticatedAccess("/api/auth/callback")).toEqual({ type: "allow" });
  });

  it("redirects unauthenticated page routes that require auth", () => {
    expect(decideUnauthenticatedAccess("/events")).toEqual({ type: "redirect_signin" });
    expect(decideUnauthenticatedAccess("/library")).toEqual({ type: "redirect_signin" });
  });

  it("allows public pages", () => {
    expect(decideUnauthenticatedAccess("/")).toEqual({ type: "allow" });
    expect(decideUnauthenticatedAccess("/auth/signin")).toEqual({ type: "allow" });
  });
});
