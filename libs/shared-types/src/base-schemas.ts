import { z } from 'zod';

/**
 * Base schema for timestamps
 * Provides createdAt and updatedAt fields for all entities
 */
export const TimestampsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Base schema for identifiable entities
 * Provides id field validation
 */
export const IdentifiableSchema = z.object({
  id: z.string().min(1),
});

/**
 * Input schema for id-only requests
 * Keeps validation minimal for router inputs
 */
export const IdInputSchema = z.object({
  id: z.string(),
});

/**
 * Base metrics schema for votable entities (publications, comments)
 * Common voting metrics with upvotes, downvotes, and score
 */
export const VotableMetricsSchema = z.object({
  upvotes: z.number().int().min(0),
  downvotes: z.number().int().min(0),
  score: z.number().int(),
});

/**
 * Schema for polymorphic references
 * Used for votes that can target either publications or other votes
 */
export const PolymorphicReferenceSchema = z.object({
  targetType: z.enum(['publication', 'vote', 'document-variant']),
  targetId: z.string().min(1),
});

/**
 * Schema for currency information
 * Provides singular, plural, and genitive forms for currency names
 */
export const CurrencySchema = z.object({
  singular: z.string().min(1),
  plural: z.string().min(1),
  genitive: z.string().min(1),
});

/** Merit amount with one decimal place (0.1 step). Float-safe (avoids IEEE 754 multipleOf pitfalls). */
export const MeritAmountSchema = z.number().refine(
  (n) => Number.isFinite(n) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-8,
  { message: 'Must be a multiple of 0.1' },
);
export const NonNegativeMeritAmountSchema = MeritAmountSchema.min(0);
export const PositiveMeritAmountSchema = MeritAmountSchema.positive();
