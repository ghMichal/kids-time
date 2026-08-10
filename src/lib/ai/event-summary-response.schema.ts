import { z } from "zod";

export const eventSummaryResponseSchema = z.object({
  summary: z.string().trim().min(1).max(200),
});

export type EventSummaryResponse = z.infer<typeof eventSummaryResponseSchema>;

/** Raw model output before trim/length normalization. */
export const eventSummaryResponseFromModelSchema = z.object({
  summary: z.string(),
});

export const eventSummaryOpenRouterJsonSchema = {
  name: "event_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Krótkie podsumowanie wydarzenia dla rodzica, maksymalnie 200 znaków.",
      },
    },
    required: ["summary"],
    additionalProperties: false,
  },
} as const;

export const eventSummaryOpenRouterResponseFormat = {
  type: "json_schema" as const,
  json_schema: eventSummaryOpenRouterJsonSchema,
};
