import { describe, expect, it } from "vitest";

import { isPublicPath, requiresAuth } from "@/lib/route-access";

describe("route-access", () => {
  describe("isPublicPath", () => {
    it("treats the landing page as public", () => {
      expect(isPublicPath("/")).toBe(true);
      expect(isPublicPath("")).toBe(true);
    });

    it("treats /auth and /api/auth prefixes as public", () => {
      expect(isPublicPath("/auth")).toBe(true);
      expect(isPublicPath("/auth/signin")).toBe(true);
      expect(isPublicPath("/api/auth")).toBe(true);
      expect(isPublicPath("/api/auth/callback")).toBe(true);
    });
  });

  describe("requiresAuth", () => {
    it("requires auth for protected API routes", () => {
      expect(requiresAuth("/api/events")).toBe(true);
      expect(requiresAuth("/api/ai/suggestions")).toBe(true);
    });

    it("keeps /api/auth public while /api/events is protected", () => {
      expect(isPublicPath("/api/auth")).toBe(true);
      expect(requiresAuth("/api/auth")).toBe(false);
      expect(requiresAuth("/api/events")).toBe(true);
    });
  });
});
