import { z } from 'zod';

// ============================================
// TAPPALKA SETTINGS
// ============================================

export const TappalkaSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  winReward: z.number().positive().default(1),
  userReward: z.number().positive().default(1),
  comparisonsRequired: z.number().int().positive().default(10),
  showCost: z.number().nonnegative().default(0.1),
  minRating: z.number().nonnegative().default(1),
  onboardingText: z.string().optional(),
});

export type TappalkaSettings = z.infer<typeof TappalkaSettingsSchema>;

// ============================================
// TAPPALKA API SCHEMAS
// ============================================

/** Post data for tappalka display */
export const TappalkaPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
  authorName: z.string(),
  authorAvatarUrl: z.string().optional(),
  rating: z.number(),
  categoryId: z.string().optional(),
});

export type TappalkaPost = z.infer<typeof TappalkaPostSchema>;

/** Pair of posts for comparison */
export const TappalkaPairSchema = z.object({
  postA: TappalkaPostSchema,
  postB: TappalkaPostSchema,
  /** Unique identifier for this comparison session */
  sessionId: z.string(),
});

export type TappalkaPair = z.infer<typeof TappalkaPairSchema>;

/** User's tappalka progress in a community */
export const TappalkaProgressSchema = z.object({
  /** Current comparisons count (resets after reaching comparisonsRequired) */
  currentComparisons: z.number().int().nonnegative(),
  /** Comparisons needed for reward (from community settings) */
  comparisonsRequired: z.number().int().positive(),
  /** User's current merit balance (global) */
  meritBalance: z.number(),
  /** Whether user has seen onboarding for this community */
  onboardingSeen: z.boolean(),
  /** Onboarding text from community settings */
  onboardingText: z.string().optional(),
});

export type TappalkaProgress = z.infer<typeof TappalkaProgressSchema>;

/** Result of submitting a choice */
export const TappalkaChoiceResultSchema = z.object({
  success: z.boolean(),
  /** New comparison count after this choice */
  newComparisonCount: z.number().int(),
  /** Merits earned by user (if completed comparisonsRequired) */
  userMeritsEarned: z.number().optional(),
  /** Whether this choice completed a reward cycle */
  rewardEarned: z.boolean(),
  /** Next pair (for seamless UX) */
  nextPair: TappalkaPairSchema.optional(),
  /** Message if no more posts available */
  noMorePosts: z.boolean().optional(),
});

export type TappalkaChoiceResult = z.infer<typeof TappalkaChoiceResultSchema>;

// ============================================
// TAPPALKA API INPUT SCHEMAS
// ============================================

export const GetTappalkaPairInputSchema = z.object({
  communityId: z.string(),
});

export type GetTappalkaPairInput = z.infer<typeof GetTappalkaPairInputSchema>;

export const SubmitTappalkaChoiceInputSchema = z.object({
  communityId: z.string(),
  sessionId: z.string(),
  winnerPostId: z.string(),
  loserPostId: z.string(),
});

export type SubmitTappalkaChoiceInput = z.infer<typeof SubmitTappalkaChoiceInputSchema>;

export const GetTappalkaProgressInputSchema = z.object({
  communityId: z.string(),
});

export type GetTappalkaProgressInput = z.infer<typeof GetTappalkaProgressInputSchema>;

export const MarkTappalkaOnboardingSeenInputSchema = z.object({
  communityId: z.string(),
});

export type MarkTappalkaOnboardingSeenInput = z.infer<typeof MarkTappalkaOnboardingSeenInputSchema>;

// ============================================
// TAPPALKA SETTINGS UPDATE SCHEMA
// ============================================

export const UpdateTappalkaSettingsInputSchema = z.object({
  communityId: z.string(),
  settings: TappalkaSettingsSchema.partial(),
});

export type UpdateTappalkaSettingsInput = z.infer<typeof UpdateTappalkaSettingsInputSchema>;

