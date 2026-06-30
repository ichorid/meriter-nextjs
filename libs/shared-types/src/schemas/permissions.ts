import { z } from 'zod';

/** Granular role → action → allow/deny rule conditions. */
export const PermissionRuleConditionsSchema = z.object({
  requiresTeamMembership: z.boolean().optional(),
  onlyTeamLead: z.boolean().optional(),
  canVoteForOwnPosts: z.boolean().optional(),
  participantsCannotVoteForLead: z.boolean().optional(),
  canEditWithVotes: z.boolean().optional(),
  canEditWithComments: z.boolean().optional(),
  canEditAfterMinutes: z.number().int().min(0).optional(),
  canDeleteWithVotes: z.boolean().optional(),
  canDeleteWithComments: z.boolean().optional(),
  teamOnly: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

/** Granular role → action → allow/deny rules. */
export const PermissionRuleSchema = z.object({
  role: z.enum(['superadmin', 'lead', 'participant']),
  action: z.string(), // ActionType enum value
  allowed: z.boolean(),
  conditions: PermissionRuleConditionsSchema.optional(),
});

/**
 * Server-computed permissions embedded on publications, comments, and polls.
 * All permission checks are performed server-side (inv-11).
 */
export const ResourcePermissionsSchema = z.object({
  canVote: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canComment: z.boolean(),
  /** Birzha source post: manager can top up rating from the source CommunityWallet */
  canTopUpFromSourceEntityWallet: z.boolean().optional(),
  voteDisabledReason: z.string().optional(),
  editDisabledReason: z.string().optional(),
  deleteDisabledReason: z.string().optional(),
});

export type PermissionRule = z.infer<typeof PermissionRuleSchema>;
export type PermissionRuleConditions = z.infer<typeof PermissionRuleConditionsSchema>;
export type ResourcePermissions = z.infer<typeof ResourcePermissionsSchema>;
