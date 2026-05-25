/**
 * Route access policy: product pages are protected by default.
 * Add new public paths here; do not extend middleware for each new page.
 */

const PUBLIC_PATH_PREFIXES = ["/auth", "/api/auth", "/_astro"] as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") {
    return true;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function requiresAuth(pathname: string): boolean {
  return !isPublicPath(pathname);
}
