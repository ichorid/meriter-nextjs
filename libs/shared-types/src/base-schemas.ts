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
 * Used for comments and votes that can target either publications or comments
 */
export const PolymorphicReferenceSchema = z.object({
  targetType: z.enum(['publication', 'comment']),
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

