export const EVENT_IMAGES_BUCKET = "event-images" as const;

export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const EVENT_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type EventImageMimeType = (typeof EVENT_IMAGE_ALLOWED_MIME_TYPES)[number];
