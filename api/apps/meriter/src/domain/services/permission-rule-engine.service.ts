import { Injectable, Logger } from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import { GLOBAL_ROLE_SUPERADMIN, COMMUNITY_ROLE_SUPERADMIN } from '../common/constants/roles.constants';
import { PermissionRule, PermissionContext, Community } from '../models/community/community.schema';
import { UserService } from './user.service';
import { CommunityService } from './community.service';
import { CommunityDefaultsService } from './community-defaults.service';
import { PermissionContextService } from './permission-context.service';
import { PermissionService } from './permission.service';

/**
 * PermissionRuleEngine
 * 
 * Core service for evaluating permissions using a rule engine pattern.
 * Resolution order:
 * 1. Special status checks (superadmin, team membership)
 * 2. Community-specific rules from DB
 * 3. Default rules for community type
 * 4. Default deny
 */
@Injectable()
export class PermissionRuleEngine {
  private readonly logger = new Logger(PermissionRuleEngine.name);

  constructor(
    private userService: UserService,
    private communityService: CommunityService,
    private communityDefaultsService: CommunityDefaultsService,
    private permissionContextService: PermissionContextService,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
  ) {}

  /**
   * Check if user can perform action
   * 
   * @param userId User ID
   * @param communityId Community ID
   * @param action Action to check
   * @param context Optional permission context (for resource-specific checks)
   * @returns true if allowed, false if denied
   */
  async canPerformAction(
    userId: string,
    communityId: string,
    action: ActionType,
    context?: PermissionContext,
  ): Promise<boolean> {
    this.logger.debug(
      `[canPerformAction] userId=${userId}, communityId=${communityId}, action=${action}`,
    );

    // STEP 1: Special status checks (highest priority)
    const specialStatusResult = await this.checkSpecialStatus(
      userId,
      communityId,
      action,
      context,
    );
    if (specialStatusResult !== null) {
      this.logger.debug(
        `[canPerformAction] Special status check result: ${specialStatusResult}`,
      );
      return specialStatusResult;
    }

    // STEP 2: Get user role
    const userRole = await this.permissionService.getUserRoleInCommunity(
      userId,
      communityId,
    );
    if (!userRole) {
      this.logger.debug(`[canPerformAction] User has no role in community, denying`);
      return false; // No role = deny
    }

    // STEP 3: Get community
    const community = await this.communityService.getCommunity(communityId);
    if (!community) {
      this.logger.warn(`[canPerformAction] Community not found: ${communityId}`);
      return false;
    }

    // STEP 4: Get effective rules (DB rules merged with defaults)
    const effectiveRules = this.communityService.getEffectivePermissionRules(community);

    // STEP 5: Find matching rule for user role and action
    const matchingRule = this.findMatchingRule(effectiveRules, userRole, action);

    if (!matchingRule) {
      // No matching rule found = deny by default
      this.logger.debug(
        `[canPerformAction] No matching rule found for role=${userRole}, action=${action}, denying`,
      );
      return false;
    }

    // STEP 6: Check if rule allows the action
    if (!matchingRule.allowed) {
      this.logger.debug(
        `[canPerformAction] Rule explicitly denies: role=${userRole}, action=${action}`,
      );
      return false;
    }

    // STEP 7: Special handling for team communities
    if (community.typeTag === 'team' && action === ActionType.VOTE) {
      // In team communities, only team members can vote
      if (!context?.isTeamMember) {
        this.logger.debug(
          `[canPerformAction] DENIED: Not a team member in team community`,
        );
        return false;
      }
      // Team members can vote for each other but not themselves
      if (context?.isAuthor) {
        this.logger.debug(
          `[canPerformAction] DENIED: Cannot vote for own post in team community`,
        );
        return false;
      }
      // Team member voting for another team member - allow
      this.logger.debug(
        `[canPerformAction] ALLOWED: Team member voting for another team member`,
      );
      return true;
    }

    // STEP 8: Evaluate conditions
    if (matchingRule.conditions) {
      const conditionsMet = await this.evaluateConditions(
        userId,
        community,
        matchingRule.conditions,
        context,
        action,
      );
      if (!conditionsMet) {
        this.logger.debug(
          `[canPerformAction] Conditions not met for rule: role=${userRole}, action=${action}`,
        );
        return false;
      }
    }

    this.logger.debug(
      `[canPerformAction] ALLOWED: role=${userRole}, action=${action}`,
    );
    return true;
  }

  /**
   * Check special status (superadmin, team membership, etc.)
   * Returns null if no special status applies, true/false if it does
   */
  private async checkSpecialStatus(
    userId: string,
    communityId: string,
    action: ActionType,
    context?: PermissionContext,
  ): Promise<boolean | null> {
    // Check superadmin status
    const user = await this.userService.getUserById(userId);
    if (!user) {
      return false; // User not found = deny
    }

    const isSuperadmin = user.globalRole === GLOBAL_ROLE_SUPERADMIN;

    if (isSuperadmin) {
      // Superadmin can do almost everything, but with some restrictions
      // For voting: cannot vote for own posts
      if (action === ActionType.VOTE) {
        if (context?.isAuthor) {
          // Exception: future-vision allows self-voting for superadmin
          const community = await this.communityService.getCommunity(communityId);
          if (community?.typeTag === 'future-vision') {
            return true;
          }
          return false; // Cannot vote for own posts
        }
        return true; // Can vote for others
      }

      // For other actions, superadmin is allowed
      // But for edit/delete, check if it's their own resource or they're lead
      if (action === ActionType.EDIT_PUBLICATION || action === ActionType.DELETE_PUBLICATION) {
        // Superadmin can edit/delete anything
        return true;
      }

      if (action === ActionType.EDIT_COMMENT || action === ActionType.DELETE_COMMENT) {
        // Superadmin can edit/delete any comment
        return true;
      }

      if (action === ActionType.EDIT_POLL || action === ActionType.DELETE_POLL) {
        // Superadmin can edit/delete any poll
        return true;
      }

      // For all other actions, superadmin is allowed
      return true;
    }

    // No special status applies
    return null;
  }

  /**
   * Find matching rule for role and action
   */
  private findMatchingRule(
    rules: PermissionRule[],
    role: 'superadmin' | 'lead' | 'participant' | 'viewer',
    action: ActionType,
  ): PermissionRule | null {
    // Find the most specific rule (DB rules come first, then defaults)
    // Rules are ordered: DB rules first, then defaults
    // We want the first matching rule (DB rules override defaults)
    return rules.find(rule => rule.role === role && rule.action === action) || null;
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateConditions(
    userId: string,
    community: Community,
    conditions: PermissionRule['conditions'],
    context?: PermissionContext,
    action?: ActionType,
  ): Promise<boolean> {
    if (!conditions) {
      return true; // No conditions = pass
    }

    // Check requiresTeamMembership
    if (conditions.requiresTeamMembership) {
      // For team communities, check if user is a member of THIS team community
      // For other communities, check if user has membership in ANY team-type community
      if (community.typeTag === 'team') {
        if (!context?.isTeamMember) {
          return false;
        }
      } else {
        if (!context?.hasTeamMembership) {
          return false;
        }
      }
    }

    // Check onlyTeamLead
    if (conditions.onlyTeamLead) {
      const userRole = await this.permissionService.getUserRoleInCommunity(
        userId,
        community.id,
      );
      if (userRole !== 'lead') {
        return false;
      }
    }

    // Check canVoteForOwnPosts
    if (conditions.canVoteForOwnPosts !== undefined && action === ActionType.VOTE) {
      if (context?.isAuthor && !conditions.canVoteForOwnPosts) {
        // Exception: future-vision allows self-voting
        if (community.typeTag === 'future-vision') {
          return true;
        }
        return false;
      }
    }

    // Check participantsCannotVoteForLead
    if (conditions.participantsCannotVoteForLead && action === ActionType.VOTE) {
      if (context?.authorRole === 'lead' && context?.sharedTeamCommunities?.length > 0) {
        return false;
      }
    }

    // Check canEditWithVotes
    if (conditions.canEditWithVotes !== undefined) {
      if (context?.hasVotes && !conditions.canEditWithVotes) {
        return false;
      }
    }

    // Check canEditWithComments
    if (conditions.canEditWithComments !== undefined) {
      if (context?.hasComments && !conditions.canEditWithComments) {
        return false;
      }
    }

    // Check canEditAfterDays
    // If canEditAfterDays is set in conditions, use it; otherwise check community settings
    if (context?.daysSinceCreation !== undefined) {
      let editWindowDays: number;
      if (conditions.canEditAfterDays !== undefined) {
        editWindowDays = conditions.canEditAfterDays;
      } else {
        // Get from community settings (default is 7)
        editWindowDays = community.settings?.editWindowDays ?? 7;
      }

      if (editWindowDays === 0) {
        // 0 means no time limit
        return true;
      }
      // Use < to match original logic: can edit for editWindowDays days (days 0 to editWindowDays-1)
      // If daysSinceCreation is 8 and editWindowDays is 7, should return false
      if (context.daysSinceCreation >= editWindowDays) {
        return false;
      }
    }

    // Check canDeleteWithVotes
    if (conditions.canDeleteWithVotes !== undefined) {
      if (context?.hasVotes && !conditions.canDeleteWithVotes) {
        return false;
      }
    }

    // Check canDeleteWithComments
    if (conditions.canDeleteWithComments !== undefined) {
      if (context?.hasComments && !conditions.canDeleteWithComments) {
        return false;
      }
    }

    // Check teamOnly
    if (conditions.teamOnly) {
      if (!context?.hasTeamMembership) {
        return false;
      }
    }

    // Check isHidden
    if (conditions.isHidden) {
      return false; // Hidden communities are not visible
    }

    return true;
  }
}

