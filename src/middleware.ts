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

  if (requiresAuth(context.url.pathname) && !context.locals.user) {
    return context.redirect("/auth/signin");
  }

  return next();
});
