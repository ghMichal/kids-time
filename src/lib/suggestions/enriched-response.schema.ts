import { z } from "zod";
import { suggestionItemSchema } from "@/lib/ai/suggestion-response.schema";

export const enrichedSuggestionItemSchema = suggestionItemSchema.extend({
  imageUrl: z
    .string()
    .optional()
    .refine((value) => value === undefined || z.url().safeParse(value).success, {
      message: "Invalid URL",
    })
    .refine((value) => value === undefined || value.startsWith("https://"), {
      message: "HTTPS required",
    }),
});

export const enrichedSuggestionResponseSchema = z.object({
  suggestions: z.array(enrichedSuggestionItemSchema).min(1).max(5),
});

export type EnrichedSuggestionItem = z.infer<typeof enrichedSuggestionItemSchema>;
export type EnrichedSuggestionResponse = z.infer<typeof enrichedSuggestionResponseSchema>;
