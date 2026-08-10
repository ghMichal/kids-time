import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVENT_IMAGE_ALLOWED_MIME_TYPES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGES_BUCKET,
  type EventImageMimeType,
} from "@/lib/storage/constants";
import {
  assertAllowedMimeType,
  assertExtensionMatchesMime,
  assertOwnerPath,
  buildEventImagePath,
  eventImageFolderPrefix,
  sanitizeEventImageFilename,
} from "@/lib/storage/event-image-path";

/** Signed URL lifetime for owner library previews (1 hour). */
export const EVENT_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

export type EventImageErrorCode =
  | "invalid_file"
  | "invalid_path"
  | "owner_mismatch"
  | "upload_failed"
  | "remove_failed"
  | "replace_failed";

export class EventImageError extends Error {
  readonly code: EventImageErrorCode;

  constructor(code: EventImageErrorCode, message: string) {
    super(message);
    this.name = "EventImageError";
    this.code = code;
  }
}

export interface EventImageUploadInput {
  ownerId: string;
  eventId: string;
  file: Blob;
  filename?: string;
  contentType?: string;
}

export type EventImageReplaceInput = EventImageUploadInput & {
  imagePath?: string | null;
};

interface FileLike {
  size: number;
  type?: string;
  name?: string;
}

function resolveFilename(file: FileLike, filename?: string): string {
  if (filename) {
    return sanitizeEventImageFilename(filename);
  }
  if (file.name) {
    return sanitizeEventImageFilename(file.name);
  }
  throw new EventImageError("invalid_file", "Image filename is required.");
}

function resolveMimeType(file: FileLike, filename: string, contentType?: string): EventImageMimeType {
  const candidates = [contentType, file.type].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      const mimeType = assertAllowedMimeType(candidate, filename);
      assertExtensionMatchesMime(filename, mimeType);
      return mimeType;
    } catch {
      continue;
    }
  }

  try {
    const mimeType = assertAllowedMimeType("", filename);
    assertExtensionMatchesMime(filename, mimeType);
    return mimeType;
  } catch {
    throw new EventImageError(
      "invalid_file",
      `Image type must be one of: ${EVENT_IMAGE_ALLOWED_MIME_TYPES.join(", ")}.`,
    );
  }
}

export function validateEventImageFile(
  file: FileLike,
  filename?: string,
  contentType?: string,
): {
  filename: string;
  mimeType: EventImageMimeType;
} {
  if (file.size <= 0) {
    throw new EventImageError("invalid_file", "Image file is empty.");
  }
  if (file.size > EVENT_IMAGE_MAX_BYTES) {
    throw new EventImageError("invalid_file", "Image file exceeds the 5 MB limit.");
  }

  const resolvedFilename = resolveFilename(file, filename);
  const mimeType = resolveMimeType(file, resolvedFilename, contentType);
  return { filename: resolvedFilename, mimeType };
}

async function removeObjects(client: SupabaseClient, paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  const { error } = await client.storage.from(EVENT_IMAGES_BUCKET).remove(paths);
  if (error) {
    throw new EventImageError("remove_failed", "Failed to remove event image.");
  }
}

async function removeAllInEventFolder(client: SupabaseClient, ownerId: string, eventId: string): Promise<void> {
  const prefix = eventImageFolderPrefix(ownerId, eventId);
  const { data, error } = await client.storage.from(EVENT_IMAGES_BUCKET).list(prefix);
  if (error) {
    throw new EventImageError("remove_failed", "Failed to list event images.");
  }

  const paths = data.map((item) => `${prefix}/${item.name}`);
  await removeObjects(client, paths);
}

export async function uploadEventImage(
  client: SupabaseClient,
  input: EventImageUploadInput,
): Promise<{ path: string; mimeType: EventImageMimeType }> {
  const { filename, mimeType } = validateEventImageFile(input.file, input.filename, input.contentType);
  let path: string;
  try {
    path = buildEventImagePath({
      ownerId: input.ownerId,
      eventId: input.eventId,
      filename,
    });
  } catch {
    throw new EventImageError("invalid_path", "Invalid event image path.");
  }

  const { error } = await client.storage.from(EVENT_IMAGES_BUCKET).upload(path, input.file, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) {
    throw new EventImageError("upload_failed", "Failed to upload event image.");
  }

  return { path, mimeType };
}

export async function removeEventImage(client: SupabaseClient, imagePath: string, ownerId: string): Promise<void> {
  try {
    assertOwnerPath(imagePath, ownerId);
  } catch {
    throw new EventImageError("owner_mismatch", "Image path does not belong to this owner.");
  }

  await removeObjects(client, [imagePath]);
}

/**
 * Owner-only signed URL for a private event image.
 * Returns null on owner mismatch or Storage failure — callers must not fail the whole list.
 */
export async function createEventImageSignedUrl(
  client: SupabaseClient,
  imagePath: string,
  ownerId: string,
): Promise<string | null> {
  try {
    assertOwnerPath(imagePath, ownerId);
  } catch {
    return null;
  }

  const { data, error } = await client.storage
    .from(EVENT_IMAGES_BUCKET)
    .createSignedUrl(imagePath, EVENT_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error || !data.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function replaceEventImage(
  client: SupabaseClient,
  input: EventImageReplaceInput,
): Promise<{ path: string; mimeType: EventImageMimeType }> {
  if (input.imagePath) {
    try {
      assertOwnerPath(input.imagePath, input.ownerId);
    } catch {
      throw new EventImageError("owner_mismatch", "Image path does not belong to this owner.");
    }
    await removeObjects(client, [input.imagePath]);
  }

  try {
    await removeAllInEventFolder(client, input.ownerId, input.eventId);
  } catch (error) {
    if (error instanceof EventImageError) {
      throw new EventImageError("replace_failed", error.message);
    }
    throw new EventImageError("replace_failed", "Failed to replace event image.");
  }

  try {
    return await uploadEventImage(client, input);
  } catch (error) {
    if (error instanceof EventImageError) {
      throw new EventImageError("replace_failed", error.message);
    }
    throw new EventImageError("replace_failed", "Failed to replace event image.");
  }
}
