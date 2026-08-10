import { z } from "zod";

export const eventSummaryRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).nullable().optional(),
    place: z.string().trim().min(1).max(200).nullable().optional(),
    childAge: z.number().int().min(0).max(18).nullable().optional(),
    locationKind: z.enum(["indoor", "outdoor"]).nullable().optional(),
  })
  .strict();

export type EventSummaryRequest = z.infer<typeof eventSummaryRequestSchema>;
