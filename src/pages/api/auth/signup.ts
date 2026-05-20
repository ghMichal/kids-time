import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const origin = new URL(context.request.url).origin;
  const emailRedirectTo = `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Supabase returns success without a new email when the address already exists
  // (empty identities). Resend confirmation for unconfirmed users.
  const isNewUser = (data.user?.identities?.length ?? 0) > 0;
  if (!isNewUser) {
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });
  }

  return context.redirect("/auth/confirm-email");
};
