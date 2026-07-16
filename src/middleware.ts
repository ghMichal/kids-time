import { defineMiddleware } from "astro:middleware";
import { requiresAuth } from "@/lib/route-access";
import { createClient } from "@/lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (!context.locals.user) {
    const { pathname } = context.url;

    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (requiresAuth(pathname)) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
