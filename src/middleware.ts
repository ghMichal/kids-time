import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { decideUnauthenticatedAccess } from "@/lib/unauthenticated-api-guard";

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
    const decision = decideUnauthenticatedAccess(context.url.pathname);

    if (decision.type === "json_401") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (decision.type === "redirect_signin") {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
