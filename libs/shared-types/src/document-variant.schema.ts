import { z } from 'zod';

/** Collaborative document block variant (range-aware, v2). */
export const DocumentBlockVariantRangeSchema = z.object({
  rangeStart: z.number().int().min(0).optional(),
  rangeEnd: z.number().int().min(0).optional(),
  proposedText: z.string().max(5000).optional(),
  officialTextHashAtPropose: z.string().max(64).optional(),
});

export type DocumentBlockVariantRange = z.infer<typeof DocumentBlockVariantRangeSchema>;
