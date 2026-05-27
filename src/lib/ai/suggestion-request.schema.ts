import { z } from "zod";

export const suggestionRequestSchema = z.object({
  place: z.string().trim().min(1).max(200),
  time: z.string().trim().min(1).max(200),
  childAge: z.number().int().min(0).max(18),
  indoorOutdoor: z.enum(["indoor", "outdoor", "either"]),
});

export type SuggestionRequest = z.infer<typeof suggestionRequestSchema>;
