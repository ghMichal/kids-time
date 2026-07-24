import type { SupabaseClient } from "@supabase/supabase-js";
import { EventImageError, removeEventImage } from "@/lib/storage/event-image";
import type { Database } from "@/types";

export async function deleteOwnEvent(
  client: SupabaseClient<Database>,
  ownerId: string,
  eventId: string,
): Promise<{ ok: true } | { error: "not_found" | "delete_failed" }> {
  const { data: existing, error: fetchError } = await client
    .from("events")
    .select("id, image_path")
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (fetchError) {
    return { error: "delete_failed" };
  }

  if (!existing) {
    return { error: "not_found" };
  }

  if (existing.image_path) {
    try {
      await removeEventImage(client, existing.image_path, ownerId);
    } catch (error) {
      if (!(error instanceof EventImageError)) {
        return { error: "delete_failed" };
      }
      // Continue with row delete if storage object is already missing / mismatched.
    }
  }

  const { data: deleted, error: deleteError } = await client
    .from("events")
    .delete()
    .eq("id", eventId)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    return { error: "delete_failed" };
  }

  if (!deleted) {
    return { error: "not_found" };
  }

  return { ok: true };
}
