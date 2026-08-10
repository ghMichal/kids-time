import { z } from "zod";

const optionalSummarySchema = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    }
    return value;
  },
  z.union([z.string().min(1).max(200), z.null()]).optional(),
);

export const manualEventCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    summary: optionalSummarySchema,
    description: z.string().trim().max(2000).nullable().optional(),
    place: z.string().trim().min(1).max(200).nullable().optional(),
    childAge: z.number().int().min(0).max(18).nullable().optional(),
    locationKind: z.enum(["indoor", "outdoor"]).nullable().optional(),
  })
  .strict();

export type ManualEventCreateRequest = z.infer<typeof manualEventCreateSchema>;
