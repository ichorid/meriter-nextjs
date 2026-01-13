import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ActionType } from '../../common/constants/action-types.constants';
import { GLOBAL_ROLE_SUPERADMIN } from '../../common/constants/roles.constants';
import { CommunityService } from '../community.service';
import { PermissionService } from '../permission.service';
import { UserService } from '../user.service';
import { Community } from '../../models/community/community.schema';
import { RoleHierarchyResult, VoteFactorContext } from './vote-factor.types';

/**
 * Factor 1: Role Hierarchy
 * 
 * Base access control layer based on role ranks.
 * Respects DB settings: permissionRules and votingSettings.votingRestriction
 */
@Injectable()
export class RoleHierarchyFactor {
  private readonly logger = new Logger(RoleHierarchyFactor.name);

  constructor(
    private communityService: CommunityService,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
    private userService: UserService,
  ) {}

  /**
   * Evaluate role hierarchy for permission check
   * 
   * @param context Vote factor context
   * @returns Role hierarchy result (allowed or denied)
   */
  async evaluate(context: VoteFactorContext): Promise<RoleHierarchyResult> {
    const { userId, communityId, action, community: contextCommunity, effectiveBeneficiaryId, sharedTeamCommunities } = context;

    if (!action) {
      return { allowed: false, reason: 'No action specified' };
    }

    // STEP 1: Check superadmin status (special bypass)
    const user = await this.userService.getUserById(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const isSuperadmin = user.globalRole === GLOBAL_ROLE_SUPERADMIN;
    if (isSuperadmin) {
      // Superadmin can always perform actions (no further checks needed)
      // Note: Self-voting is now a currency constraint, not a permission block
      this.logger.debug(`[evaluate] Superadmin bypass for userId=${userId}, action=${action}`);
      return { allowed: true };
    }

    // STEP 2: Get community
    const community = contextCommunity || await this.communityService.getCommunity(communityId);
    if (!community) {
      return { allowed: false, reason: 'Community not found' };
    }

    // STEP 3: Get user role
    const userRole = await this.permissionService.getUserRoleInCommunity(userId, communityId);
    if (!userRole) {
      return { allowed: false, reason: 'User has no role in community' };
    }

    // STEP 4: Get effective permission rules (DB rules override defaults)
    const effectiveRules = this.communityService.getEffectivePermissionRules(community);

    // STEP 5: Find matching rule for user role and action
    const matchingRule = effectiveRules.find(
      rule => rule.role === userRole && rule.action === action
    );

    if (!matchingRule) {
      return { allowed: false, reason: `No matching rule found for role=${userRole}, action=${action}` };
    }

    // STEP 5.5: HIGH PRIORITY CHECK - canVoteForOwnPosts condition (voting only)
    // This check has the highest priority - if canVoteForOwnPosts is false, user cannot vote for own posts
    // regardless of other rules
    if (action === ActionType.VOTE && matchingRule.conditions?.canVoteForOwnPosts !== undefined) {
      if (context.isEffectiveBeneficiary && !matchingRule.conditions.canVoteForOwnPosts) {
        this.logger.debug(
          `[evaluate] HIGH PRIORITY BLOCK: Cannot vote for own posts (canVoteForOwnPosts=false)`,
        );
        return { allowed: false, reason: 'Cannot vote for own posts (canVoteForOwnPosts=false)' };
      }
    }

    // STEP 6: Check if rule allows the action
    if (!matchingRule.allowed) {
      return { allowed: false, reason: `Rule explicitly denies: role=${userRole}, action=${action}` };
    }

    // STEP 7: Check voting restrictions from community settings
    if (action === ActionType.VOTE && community.votingSettings?.votingRestriction) {
      const restriction = community.votingSettings.votingRestriction;
      
      // Check restriction: "not-same-team" - cannot vote if users share team communities
      if (restriction === 'not-same-team' && effectiveBeneficiaryId) {
        // Check if voter and beneficiary share team communities
        const hasSharedTeamCommunities = (sharedTeamCommunities?.length ?? 0) > 0;
        
        if (hasSharedTeamCommunities) {
          return { 
            allowed: false, 
            reason: 'Users share team communities (not-same-team restriction)' 
          };
        }
      }
      
      // Note: 'not-own' restriction is removed (now handled as currency constraint)
      // Restriction "any" allows all votes (no additional checks needed)
    }

    // STEP 8: Special handling for team communities
    if (community.typeTag === 'team' && action === ActionType.VOTE) {
      // In team communities, only team members can vote
      if (!context.isTeamMember) {
        return { allowed: false, reason: 'Not a team member in team community' };
      }
      // Note: Self-voting is now a currency constraint, not a permission block
      // Team members can vote for each other (currency constraint applies for self)
      return { allowed: true };
    }

    // STEP 9: Evaluate rule conditions (requiresTeamMembership, etc.)
    if (matchingRule.conditions) {
      this.logger.debug(
        `[evaluate] Evaluating conditions for role=${userRole}, action=${action}, conditions=${JSON.stringify(matchingRule.conditions)}`,
      );
      const conditionsMet = await this.evaluateConditions(
        userId,
        community,
        matchingRule.conditions,
        context,
        action,
      );

      if (!conditionsMet) {
        this.logger.debug(
          `[evaluate] Conditions not met for role=${userRole}, action=${action}`,
        );
        return { allowed: false, reason: 'Rule conditions not met' };
      }
    }

    // STEP 10: Check edit/delete restrictions for participants
    if (userRole === 'participant' && (action === ActionType.EDIT_PUBLICATION || action === ActionType.DELETE_PUBLICATION || action === ActionType.EDIT_POLL || action === ActionType.DELETE_POLL)) {
      if (!context.isAuthor) {
        // Special case: allow participant to edit publications created by others only if explicitly enabled
        if (action === ActionType.EDIT_PUBLICATION) {
          const allowEditByOthers = community.settings?.allowEditByOthers ?? false;
          if (!allowEditByOthers) {
            return { allowed: false, reason: 'Participant cannot edit other user\'s publication' };
          }
        } else if (action === ActionType.EDIT_POLL || action === ActionType.DELETE_POLL) {
          // Participants can only edit/delete polls they created
          return { allowed: false, reason: `Participant can only ${action} their own polls` };
        } else {
          return { allowed: false, reason: `Participant can only ${action} their own resources` };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluate rule conditions
   */
  private async evaluateConditions(
    userId: string,
    community: Community,
    conditions: NonNullable<Community['permissionRules']>[0]['conditions'],
    context: VoteFactorContext,
    action: ActionType,
  ): Promise<boolean> {
    if (!conditions) {
      return true;
    }

    // Check requiresTeamMembership
    if (conditions.requiresTeamMembership) {
      if (community.typeTag === 'team') {
        if (!context.isTeamMember) {
          return false;
        }
      } else {
        if (!context.hasTeamMembership) {
          return false;
        }
      }
    }

    // Check onlyTeamLead
    if (conditions.onlyTeamLead) {
      const userRole = await this.permissionService.getUserRoleInCommunity(userId, community.id);
      if (userRole !== 'lead') {
        return false;
      }
    }

    // Check canEditAfterMinutes (publications only)
    if (action === ActionType.EDIT_PUBLICATION && context.minutesSinceCreation !== undefined) {
      const editorRole = await this.permissionService.getUserRoleInCommunity(userId, community.id);
      if (editorRole === 'participant') {
        const editWindowMinutes = conditions.canEditAfterMinutes ?? community.settings?.editWindowMinutes ?? 30;
        if (editWindowMinutes === 0) {
          return true; // 0 means no time limit
        }
        if (context.minutesSinceCreation >= editWindowMinutes) {
          return false;
        }
      }
    }

    // Check canDeleteWithVotes
    if (conditions.canDeleteWithVotes !== undefined) {
      if (context.hasVotes && !conditions.canDeleteWithVotes) {
        return false;
      }
    }

    // Check canDeleteWithComments
    if (conditions.canDeleteWithComments !== undefined) {
      if (context.hasComments && !conditions.canDeleteWithComments) {
        return false;
      }
    }

    // Check teamOnly
    if (conditions.teamOnly) {
      if (!context.hasTeamMembership) {
        return false;
      }
    }

    // Check isHidden
    if (conditions.isHidden) {
      return false; // Hidden communities are not visible
    }

    // Note: canVoteForOwnPosts is now checked at STEP 5.5 with highest priority,
    // so it's not checked here again

    // Check participantsCannotVoteForLead (voting only)
    if (action === ActionType.VOTE && conditions.participantsCannotVoteForLead) {
      const userRole = await this.permissionService.getUserRoleInCommunity(userId, community.id);
      if (userRole === 'participant' && context.authorRole === 'lead') {
        return false; // Participants cannot vote for lead posts
      }
    }

    return true;
  }
}
