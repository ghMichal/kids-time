import type { APIRoute } from "astro";
import { eventIdParamSchema } from "@/lib/events/event-update.schema";
import { uploadOwnEventImage } from "@/lib/events/upload-own-event-image";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isBlobLike(value: FormDataEntryValue | null): value is Blob {
  return value instanceof Blob;
}

export const POST: APIRoute = async ({ params, request, locals, cookies }) => {
  if (!locals.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const idParsed = eventIdParamSchema.safeParse(params.id);
  if (!idParsed.success) {
    return jsonResponse({ error: "validation", issues: idParsed.error.issues }, 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "invalid_form_data" }, 400);
  }

  const fileEntry = formData.get("file");
  if (!isBlobLike(fileEntry)) {
    return jsonResponse({ error: "validation", message: "Multipart field `file` is required." }, 400);
  }

  const filename = fileEntry instanceof File && fileEntry.name ? fileEntry.name : undefined;
  const contentType = fileEntry.type || undefined;

  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonResponse({ error: "configuration" }, 503);
  }

  const result = await uploadOwnEventImage(supabase, {
    ownerId: locals.user.id,
    eventId: idParsed.data,
    file: fileEntry,
    filename,
    contentType,
  });

  if ("error" in result) {
    switch (result.error) {
      case "not_found":
        return jsonResponse({ error: "not_found" }, 404);
      case "invalid_file":
        return jsonResponse({ error: "invalid_file" }, 400);
      case "upload_failed":
      case "update_failed":
        return jsonResponse({ error: "internal" }, 500);
    }
  }

  return jsonResponse({ imagePath: result.imagePath }, 201);
};
