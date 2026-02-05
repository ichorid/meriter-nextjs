import { ActionType } from '../../common/constants/action-types.constants';
import { PermissionContext, Community } from '../../models/community/community.schema';

/**
 * Common context for all vote factors
 */
export interface VoteFactorContext extends PermissionContext {
  userId: string;
  communityId: string;
  action?: ActionType;
  community?: Community;
  targetType?: 'publication' | 'vote';
  postType?: string;
  isProject?: boolean;
  direction?: 'up' | 'down';
  userRole?: 'superadmin' | 'lead' | 'participant' | null;
  effectiveBeneficiaryId?: string;
  sharedTeamCommunities?: string[];
}

/**
 * Result from Factor 1: Role Hierarchy
 */
export interface RoleHierarchyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Result from Factor 2: Social Currency Constraint
 */
export interface SocialCurrencyConstraintResult {
  constraint: 'wallet-only' | null;
  reason?: string;
}

/**
 * Result from Factor 3: Context Currency Mode
 */
export interface ContextCurrencyModeResult {
  allowedQuota: boolean;
  allowedWallet: boolean;
  requiredCurrency?: 'quota' | 'wallet';
  reason?: string;
}

/**
 * Composed result from Factors 2 + 3: Currency Mode
 */
export interface CurrencyModeResult {
  allowedQuota: boolean;
  allowedWallet: boolean;
  requiredCurrency?: 'quota' | 'wallet';
  reason?: string;
}

/**
 * Combined result from all factors
 */
export interface VoteConstraintResult {
  roleHierarchy: RoleHierarchyResult;
  socialConstraint: SocialCurrencyConstraintResult;
  contextCurrency: ContextCurrencyModeResult;
  currencyMode: CurrencyModeResult;
}
