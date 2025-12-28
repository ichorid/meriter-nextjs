import { Injectable } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import type { 
  PermissionRule, 
  CommunityMeritSettings, 
  CommunityVotingSettings 
} from '../models/community/community.schema';

/**
 * CommunityDefaultsService
 *
 * Provides default permission rules for communities based on their typeTag.
 * Defaults are stored in-memory in code, not in the database.
 * Only custom overrides are stored in the database.
 */
@Injectable()
export class CommunityDefaultsService {
  /**
   * Get default permission rules based on community typeTag
   * Returns granular PermissionRule array covering all actions and roles
   * Uses Map-based deduplication to ensure type-specific rules override base rules
   */
  getDefaultPermissionRules(typeTag?: string): PermissionRule[] {
    const baseRules = this.getBaseRules();
    const rulesMap = new Map<string, PermissionRule>();
    
    // Add base rules first
    for (const rule of baseRules) {
      rulesMap.set(`${rule.role}:${rule.action}`, rule);
    }
    
    // Override with type-specific rules
    let typeSpecificRules: PermissionRule[] = [];
    switch (typeTag) {
      case 'marathon-of-good':
        typeSpecificRules = this.getMarathonOfGoodRules();
        break;
      case 'future-vision':
        typeSpecificRules = this.getFutureVisionRules();
        break;
      case 'support':
        typeSpecificRules = this.getSupportRules();
        break;
      case 'team':
        typeSpecificRules = this.getTeamRules();
        break;
      default:
        // Custom or other types use base rules only
        break;
    }
    
    // Override base rules with type-specific rules
    for (const rule of typeSpecificRules) {
      rulesMap.set(`${rule.role}:${rule.action}`, rule);
    }
    
    return Array.from(rulesMap.values());
  }

  /**
   * Base rules that apply to all community types
   */
  private getBaseRules(): PermissionRule[] {
    const _roles: Array<'superadmin' | 'lead' | 'participant' | 'viewer'> = [
      'superadmin',
      'lead',
      'participant',
      'viewer',
    ];
    const rules: PermissionRule[] = [];

    // Superadmin can do everything (except vote for own posts, handled in rule engine)
    for (const action of Object.values(ActionType)) {
      rules.push({
        role: 'superadmin',
        action,
        allowed: true,
      });
    }

    // Lead permissions
    rules.push(
      { role: 'lead', action: ActionType.POST_PUBLICATION, allowed: true },
      { role: 'lead', action: ActionType.CREATE_POLL, allowed: true },
      { role: 'lead', action: ActionType.EDIT_PUBLICATION, allowed: true },
      { role: 'lead', action: ActionType.DELETE_PUBLICATION, allowed: true },
      { role: 'lead', action: ActionType.VOTE, allowed: true },
      { role: 'lead', action: ActionType.COMMENT, allowed: true },
      { role: 'lead', action: ActionType.EDIT_COMMENT, allowed: true },
      { role: 'lead', action: ActionType.DELETE_COMMENT, allowed: true },
      { role: 'lead', action: ActionType.EDIT_POLL, allowed: true },
      { role: 'lead', action: ActionType.DELETE_POLL, allowed: true },
      { role: 'lead', action: ActionType.VIEW_COMMUNITY, allowed: true },
    );

    // Participant permissions (base - can be overridden by type)
    rules.push(
      { role: 'participant', action: ActionType.POST_PUBLICATION, allowed: true },
      { role: 'participant', action: ActionType.CREATE_POLL, allowed: true },
      {
        role: 'participant',
        action: ActionType.EDIT_PUBLICATION,
        allowed: true,
        conditions: {
          canEditWithVotes: false,
          canEditWithComments: false,
        },
      },
      {
        role: 'participant',
        action: ActionType.DELETE_PUBLICATION,
        allowed: true,
        conditions: {
          canDeleteWithVotes: false,
          canDeleteWithComments: false,
        },
      },
      {
        role: 'participant',
        action: ActionType.VOTE,
        allowed: true,
        conditions: {
          canVoteForOwnPosts: false,
        },
      },
      { role: 'participant', action: ActionType.COMMENT, allowed: true },
      {
        role: 'participant',
        action: ActionType.EDIT_COMMENT,
        allowed: true,
        conditions: {
          canEditWithVotes: false,
        },
      },
      { role: 'participant', action: ActionType.EDIT_POLL, allowed: true },
      { role: 'participant', action: ActionType.DELETE_POLL, allowed: true },
      { role: 'participant', action: ActionType.VIEW_COMMUNITY, allowed: true },
    );

    // Viewer permissions
    rules.push(
      { role: 'viewer', action: ActionType.VIEW_COMMUNITY, allowed: true },
      // Viewers cannot post, vote (except in marathon-of-good), comment, edit, or delete
    );

    return rules;
  }

  /**
   * Marathon of Good specific rules
   */
  private getMarathonOfGoodRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Participants can post and create polls (already in base, but ensure it's explicit)
    // NOTE: teammate voting restrictions (based on shared team communities) are enforced
    // by the PermissionRuleEngine and apply only to marathon-of-good and future-vision.
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: false,
      },
    });

    // Viewers can vote in marathon-of-good
    rules.push({
      role: 'viewer',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: false,
      },
    });

    return rules;
  }

  /**
   * Future Vision specific rules
   */
  private getFutureVisionRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Participants, leads, and superadmins can vote for own posts in future-vision
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: true,
      },
    });

    rules.push({
      role: 'lead',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: true,
      },
    });

    return rules;
  }

  /**
   * Support community specific rules
   */
  private getSupportRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Participants can post, create polls, and vote freely in support communities
    // (base rules already allow this, but we make it explicit)
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: false,
      },
    });

    return rules;
  }

  /**
   * Team community specific rules
   */
  private getTeamRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Team communities require team membership for posting
    rules.push({
      role: 'participant',
      action: ActionType.POST_PUBLICATION,
      allowed: true,
      conditions: {
        requiresTeamMembership: true,
      },
    });

    rules.push({
      role: 'participant',
      action: ActionType.CREATE_POLL,
      allowed: true,
      conditions: {
        requiresTeamMembership: true,
      },
    });

    // Team communities: only team members can vote, and they can vote for each other but not themselves
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
      conditions: {
        canVoteForOwnPosts: false,
      },
    });

    // Viewers cannot see team communities
    rules.push({
      role: 'viewer',
      action: ActionType.VIEW_COMMUNITY,
      allowed: false,
    });

    return rules;
  }

  /**
   * Get default merit settings based on community typeTag
   */
  getDefaultMeritSettings(typeTag?: string): CommunityMeritSettings {
    const baseDefaults: CommunityMeritSettings = {
      dailyQuota: 100,
      quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
      canEarn: true,
      canSpend: true,
    };

    switch (typeTag) {
      case 'marathon-of-good':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'],
        };

      case 'future-vision':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        };

      case 'support':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        };

      case 'team':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        };

      default:
        return baseDefaults;
    }
  }

  /**
   * Get default voting settings based on community typeTag
   */
  getDefaultVotingSettings(_typeTag?: string): CommunityVotingSettings {
    return {
      spendsMerits: true,
      awardsMerits: true,
      votingRestriction: 'not-own', // Default: users can vote for others' posts, but not their own
      // meritConversion is optional and community-specific
    };
  }
}

