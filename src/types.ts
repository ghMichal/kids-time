export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database.generated";

import type { Tables } from "@/types/database.generated";

export type EventRow = Tables<"events">;

export type { SuggestionRequest } from "@/lib/ai/suggestion-request.schema";
export type { SuggestionResponse } from "@/lib/ai/suggestion-response.schema";
export type { EnrichedSuggestionItem, EnrichedSuggestionResponse } from "@/lib/suggestions/enriched-response.schema";
export type { BuildEventImagePathInput, EventImagePathParts } from "@/lib/storage/event-image-path";
export type {
  EventImageError,
  EventImageErrorCode,
  EventImageReplaceInput,
  EventImageUploadInput,
} from "@/lib/storage/event-image";
