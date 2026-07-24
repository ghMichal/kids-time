import { z } from "zod";
import { suggestionRequestSchema } from "@/lib/ai/suggestion-request.schema";
import { enrichedSuggestionItemSchema } from "@/lib/suggestions/enriched-response.schema";

export const triageStatusSchema = z.enum(["accepted", "rejected", "maybe"]);

export const triageRequestSchema = z.object({
  triageStatus: triageStatusSchema,
  suggestion: enrichedSuggestionItemSchema,
  criteria: suggestionRequestSchema,
});

export type TriageStatus = z.infer<typeof triageStatusSchema>;
export type TriageRequest = z.infer<typeof triageRequestSchema>;
