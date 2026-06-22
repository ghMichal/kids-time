export type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database.generated";

import type { Tables } from "@/types/database.generated";

export type EventRow = Tables<"events">;

export type { SuggestionRequest } from "@/lib/ai/suggestion-request.schema";
export type { SuggestionResponse } from "@/lib/ai/suggestion-response.schema";
