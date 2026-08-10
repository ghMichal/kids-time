import type { SupabaseClient } from "@supabase/supabase-js";
import { EventImageError, removeEventImage, replaceEventImage, uploadEventImage } from "@/lib/storage/event-image";
import type { Database } from "@/types";

export interface UploadOwnEventImageInput {
  ownerId: string;
  eventId: string;
  file: Blob;
  filename?: string;
  contentType?: string;
}

export type UploadOwnEventImageResult =
  | { imagePath: string }
  | { error: "not_found" | "invalid_file" | "upload_failed" | "update_failed" };

export async function uploadOwnEventImage(
  client: SupabaseClient<Database>,
  input: UploadOwnEventImageInput,
): Promise<UploadOwnEventImageResult> {
  const { data: existing, error: fetchError } = await client
    .from("events")
    .select("id, image_path")
    .eq("id", input.eventId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (fetchError) {
    return { error: "upload_failed" };
  }

  if (!existing) {
    return { error: "not_found" };
  }

  let uploadedPath: string;
  try {
    const uploadInput = {
      ownerId: input.ownerId,
      eventId: input.eventId,
      file: input.file,
      filename: input.filename,
      contentType: input.contentType,
      imagePath: existing.image_path,
    };

    const result = existing.image_path
      ? await replaceEventImage(client, uploadInput)
      : await uploadEventImage(client, uploadInput);

    uploadedPath = result.path;
  } catch (error) {
    if (error instanceof EventImageError) {
      if (error.code === "invalid_file" || error.code === "invalid_path") {
        return { error: "invalid_file" };
      }
      return { error: "upload_failed" };
    }
    return { error: "upload_failed" };
  }

  const { data: updated, error: updateError } = await client
    .from("events")
    .update({ image_path: uploadedPath })
    .eq("id", input.eventId)
    .eq("owner_id", input.ownerId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    try {
      await removeEventImage(client, uploadedPath, input.ownerId);
    } catch {
      // best-effort cleanup; still report update_failed
    }
    return { error: "update_failed" };
  }

  if (!updated) {
    try {
      await removeEventImage(client, uploadedPath, input.ownerId);
    } catch {
      // best-effort cleanup; still report not_found
    }
    return { error: "not_found" };
  }

  return { imagePath: uploadedPath };
}
