import { z } from "zod";

export const eventUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    summary: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    place: z.string().trim().min(1).max(200).optional(),
    childAge: z.number().int().min(0).max(18).optional(),
    locationKind: z.enum(["indoor", "outdoor"]).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type EventUpdateRequest = z.infer<typeof eventUpdateSchema>;

export const eventIdParamSchema = z.uuid();
