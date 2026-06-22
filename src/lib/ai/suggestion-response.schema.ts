import { z } from "zod";

export const suggestionItemSchema = z.object({
  title: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(200),
  sourceUrl: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed === "" ? undefined : trimmed;
    })
    .refine((value) => value === undefined || z.url().safeParse(value).success, {
      message: "Invalid URL",
    }),
});

export const suggestionResponseSchema = z.object({
  suggestions: z.array(suggestionItemSchema).min(1).max(5),
});

export type SuggestionItem = z.infer<typeof suggestionItemSchema>;
export type SuggestionResponse = z.infer<typeof suggestionResponseSchema>;

/** Raw model output may include empty sourceUrl strings before Zod normalization. */
export const suggestionResponseFromModelSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        sourceUrl: z.string().optional(),
      }),
    )
    .min(1)
    .max(5),
});

export const openRouterJsonSchema = {
  name: "activity_suggestions",
  strict: true,
  schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            sourceUrl: { type: "string" },
          },
          required: ["title", "summary", "sourceUrl"],
          additionalProperties: false,
        },
      },
    },
    required: ["suggestions"],
    additionalProperties: false,
  },
} as const;

export const openRouterResponseFormat = {
  type: "json_schema" as const,
  json_schema: openRouterJsonSchema,
};
