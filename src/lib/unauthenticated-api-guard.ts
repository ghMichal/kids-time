import { requiresAuth } from "@/lib/route-access";

/**
 * Decision table for unauthenticated requests (middleware semantics).
 * Pure helper — no Astro runtime — so unit tests can lock the policy without SSR.
 */
export type UnauthenticatedAccessDecision = { type: "json_401" } | { type: "redirect_signin" } | { type: "allow" };

export function decideUnauthenticatedAccess(pathname: string): UnauthenticatedAccessDecision {
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return { type: "json_401" };
  }

  if (requiresAuth(pathname)) {
    return { type: "redirect_signin" };
  }

  return { type: "allow" };
}
