import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import { PermissionContext } from '../models/community/community.schema';
import { PermissionContextService } from './permission-context.service';
import { PermissionService } from './permission.service';
import { CommunityService } from './community.service';
import { RoleHierarchyFactor } from './factors/role-hierarchy.factor';
import { SocialCurrencyConstraintFactor } from './factors/social-currency-constraint.factor';
import { ContextCurrencyModeFactor } from './factors/context-currency-mode.factor';
import { CurrencyModeFactor } from './factors/currency-mode.factor';
import { MeritDestinationFactor } from './factors/merit-destination.factor';
import {
  VoteFactorContext,
  VoteConstraintResult,
  RoleHierarchyResult,
  SocialCurrencyConstraintResult,
  ContextCurrencyModeResult,
  CurrencyModeResult,
  MeritDestinationResult,
} from './factors/vote-factor.types';

/**
 * Vote Factor Service
 * 
 * Orchestrates evaluation of 4 core factors + 1 composer:
 * - Factor 1: Role Hierarchy (permission)
 * - Factor 2: Social Currency Constraint (self/teammate)
 * - Factor 3: Context Currency Mode (community/content/role/direction)
 * - Factor 4: Merit Destination (routing)
 * - CurrencyModeFactor (composer): Combines Factors 2 + 3 into a final currency mode result
 * 
 * Composes factor results into final vote constraint result.
 */
@Injectable()
export class VoteFactorService {
  private readonly logger = new Logger(VoteFactorService.name);

  constructor(
    private roleHierarchyFactor: RoleHierarchyFactor,
    private socialConstraintFactor: SocialCurrencyConstraintFactor,
    private contextCurrencyModeFactor: ContextCurrencyModeFactor,
    private currencyModeFactor: CurrencyModeFactor,
    private meritDestinationFactor: MeritDestinationFactor,
    private permissionContextService: PermissionContextService,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
    private communityService: CommunityService,
  ) {}

  /**
   * Evaluate Factor 1: Role Hierarchy
   * 
   * Checks if user has permission to perform action based on role and DB settings.
   */
  async evaluateRoleHierarchy(
    userId: string,
    communityId: string,
    action: ActionType,
    context?: VoteFactorContext,
  ): Promise<RoleHierarchyResult> {
    // Get community if not in context
    const community = context?.community || await this.communityService.getCommunity(communityId);
    if (!community) {
      return { allowed: false, reason: 'Community not found' };
    }

    // Build full context
    const fullContext: VoteFactorContext = {
      ...context,
      userId,
      communityId,
      action,
      community,
    };

    return this.roleHierarchyFactor.evaluate(fullContext);
  }

  /**
   * Evaluate Factor 2: Social Currency Constraint
   * 
   * Checks if self-voting or teammate voting requires wallet-only constraint.
   */
  async evaluateSocialCurrencyConstraint(
    userId: string,
    communityId: string,
    effectiveBeneficiaryId: string,
    sharedTeamCommunities?: string[],
  ): Promise<SocialCurrencyConstraintResult> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return { constraint: null };
    }

    const context: VoteFactorContext = {
      userId,
      communityId,
      effectiveBeneficiaryId,
      community,
      sharedTeamCommunities: sharedTeamCommunities || [],
    };

    return this.socialConstraintFactor.evaluate(context);
  }

  /**
   * Evaluate Factor 3: Context Currency Mode
   * 
   * Determines quota vs wallet constraints based on context (community/content/role/direction).
   */
  async evaluateContextCurrencyMode(
    userId: string,
    communityId: string,
    targetType: 'publication' | 'vote',
    postType?: string,
    isProject?: boolean,
    direction?: 'up' | 'down',
    userRole?: 'superadmin' | 'lead' | 'participant' | 'viewer' | null,
  ): Promise<ContextCurrencyModeResult> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    const context: VoteFactorContext = {
      userId,
      communityId,
      community,
      targetType,
      postType,
      isProject,
      direction,
      userRole,
    };

    return this.contextCurrencyModeFactor.evaluate(context);
  }

  /**
   * Evaluate Currency Mode (composed: Factor 2 + Factor 3)
   * 
   * Composes social and context constraints into final currency mode.
   */
  async evaluateCurrencyMode(
    userId: string,
    communityId: string,
    effectiveBeneficiaryId: string,
    targetType: 'publication' | 'vote',
    postType?: string,
    isProject?: boolean,
    direction?: 'up' | 'down',
    userRole?: 'superadmin' | 'lead' | 'participant' | 'viewer' | null,
    sharedTeamCommunities?: string[],
  ): Promise<CurrencyModeResult> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    const context: VoteFactorContext = {
      userId,
      communityId,
      effectiveBeneficiaryId,
      community,
      targetType,
      postType,
      isProject,
      direction,
      userRole,
      sharedTeamCommunities: sharedTeamCommunities || [],
    };

    return this.currencyModeFactor.evaluate(context);
  }

  /**
   * Evaluate Factor 4: Merit Destination
   * 
   * Determines where merits go after vote based on community type and settings.
   */
  async evaluateMeritDestination(
    communityId: string,
    effectiveBeneficiaryId: string,
    amount: number,
  ): Promise<MeritDestinationResult> {
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      return { destinations: [] };
    }

    const context: VoteFactorContext = {
      userId: '', // Not needed for merit destination
      communityId,
      effectiveBeneficiaryId,
      community,
    };

    return this.meritDestinationFactor.evaluate(context, amount);
  }

  /**
   * Evaluate all factors and return combined result
   * 
   * This is the main entry point for factor evaluation.
   */
  async evaluateAllFactors(
    userId: string,
    communityId: string,
    action: ActionType,
    effectiveBeneficiaryId: string,
    targetType: 'publication' | 'vote',
    postType?: string,
    isProject?: boolean,
    direction?: 'up' | 'down',
    sharedTeamCommunities?: string[],
    permissionContext?: Partial<PermissionContext>,
  ): Promise<VoteConstraintResult> {
    // Get user role
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);

    // Get community
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      throw new Error('Community not found');
    }

    // Build full context
    const context: VoteFactorContext = {
      userId,
      communityId,
      action,
      community,
      effectiveBeneficiaryId,
      targetType,
      postType,
      isProject,
      direction,
      userRole,
      sharedTeamCommunities: sharedTeamCommunities || [],
      ...permissionContext,
    };

    // Evaluate all factors
    const [roleHierarchy, socialConstraint, contextCurrency, currencyMode, meritDestination] = await Promise.all([
      this.roleHierarchyFactor.evaluate(context),
      this.socialConstraintFactor.evaluate(context),
      this.contextCurrencyModeFactor.evaluate(context),
      this.currencyModeFactor.evaluate(context),
      this.meritDestinationFactor.evaluate(context, 0), // Amount set to 0 for evaluation phase; actual amount provided during routing/withdrawal
    ]);

    return {
      roleHierarchy,
      socialConstraint,
      contextCurrency,
      currencyMode,
      meritDestination,
    };
  }
}
