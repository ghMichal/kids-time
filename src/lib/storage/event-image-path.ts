import { EVENT_IMAGE_ALLOWED_MIME_TYPES, type EventImageMimeType } from "@/lib/storage/constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXTENSION_TO_MIME: Record<string, EventImageMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export interface EventImagePathParts {
  ownerId: string;
  eventId: string;
  filename: string;
}

export interface BuildEventImagePathInput {
  ownerId: string;
  eventId: string;
  filename: string;
}

export class EventImagePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventImagePathError";
  }
}

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new EventImagePathError(`Invalid ${label}.`);
  }
}

export function sanitizeEventImageFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  if (!base || base === "." || base === ".." || base.includes("..")) {
    throw new EventImagePathError("Invalid filename.");
  }

  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || safe === "." || safe === "..") {
    throw new EventImagePathError("Invalid filename.");
  }

  return safe;
}

export function mimeTypeFromFilename(filename: string): EventImageMimeType | null {
  const match = /\.[a-z0-9]+$/.exec(filename.toLowerCase());
  if (!match) {
    return null;
  }
  return EXTENSION_TO_MIME[match[0]] ?? null;
}

export function assertAllowedMimeType(mimeType: string, filename?: string): EventImageMimeType {
  if (EVENT_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as EventImageMimeType)) {
    return mimeType as EventImageMimeType;
  }

  if (filename) {
    const fromExtension = mimeTypeFromFilename(filename);
    if (fromExtension) {
      return fromExtension;
    }
  }

  throw new EventImagePathError("Image type is not allowed.");
}

export function assertExtensionMatchesMime(filename: string, mimeType: EventImageMimeType): void {
  const fromExtension = mimeTypeFromFilename(filename);
  if (!fromExtension) {
    throw new EventImagePathError("Image file extension is not allowed.");
  }
  if (fromExtension !== mimeType) {
    throw new EventImagePathError("Image file extension does not match its type.");
  }
}

export function buildEventImagePath({ ownerId, eventId, filename }: BuildEventImagePathInput): string {
  assertUuid(ownerId, "owner id");
  assertUuid(eventId, "event id");
  const safeFilename = sanitizeEventImageFilename(filename);
  const mimeType = mimeTypeFromFilename(safeFilename);
  if (!mimeType) {
    throw new EventImagePathError("Image file extension is not allowed.");
  }
  return `${ownerId}/${eventId}/${safeFilename}`;
}

export function parseEventImagePath(path: string): EventImagePathParts | null {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (segments.length !== 3) {
    return null;
  }

  const [ownerId, eventId, filename] = segments;
  if (!ownerId || !eventId || !filename) {
    return null;
  }

  if (filename.includes("..")) {
    return null;
  }

  return { ownerId, eventId, filename };
}

export function isOwnerPath(path: string, ownerId: string): boolean {
  const parsed = parseEventImagePath(path);
  return parsed?.ownerId === ownerId;
}

export function assertOwnerPath(path: string, ownerId: string): void {
  if (!isOwnerPath(path, ownerId)) {
    throw new EventImagePathError("Image path does not belong to this owner.");
  }
}

export function eventImageFolderPrefix(ownerId: string, eventId: string): string {
  assertUuid(ownerId, "owner id");
  assertUuid(eventId, "event id");
  return `${ownerId}/${eventId}`;
}
