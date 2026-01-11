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
      case 'team-projects':
        typeSpecificRules = this.getTeamProjectsRules();
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

    // Superadmin can do everything
    // NOTE: Self-voting is allowed with wallet-only constraint (enforced in VoteService)
    for (const action of Object.values(ActionType)) {
      rules.push({
        role: 'superadmin',
        action,
        allowed: true,
      });
    }

    // Lead permissions
    // NOTE: Self-voting is allowed with wallet-only constraint (enforced in VoteService)
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
    // NOTE: Self-voting is allowed with wallet-only constraint (enforced in VoteService)
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
      { role: 'participant', action: ActionType.VOTE, allowed: true },
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
   * NOTE: Self-voting and teammate voting are allowed with wallet-only constraint,
   * but since MoG is quota-only for posts/comments, self/teammate voting is effectively blocked.
   * This is enforced in VoteService via currency constraints.
   */
  private getMarathonOfGoodRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Participants can vote (currency constraints in VoteService)
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
    });

    // Viewers can vote in marathon-of-good (quota-only)
    rules.push({
      role: 'viewer',
      action: ActionType.VOTE,
      allowed: true,
    });

    return rules;
  }

  /**
   * Future Vision specific rules
   * NOTE: Self-voting and teammate voting are allowed with wallet-only constraint.
   * Since FV is wallet-only for posts/comments, self/teammate voting is naturally allowed.
   * This is enforced in VoteService via currency constraints.
   */
  private getFutureVisionRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Everyone can vote (wallet-only, currency constraints in VoteService)
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
    });

    rules.push({
      role: 'lead',
      action: ActionType.VOTE,
      allowed: true,
    });

    return rules;
  }

  /**
   * Support community specific rules
   */
  private getSupportRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Participants can vote (currency constraints for self-voting in VoteService)
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
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

    // Team communities: team members can vote (self-voting requires wallet, enforced in VoteService)
    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
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
   * Team Projects community specific rules
   * - Only leads can post (participants cannot)
   * - Everyone can vote (including viewers)
   * - No merits are earned or spent (just commenting/discussion)
   */
  private getTeamProjectsRules(): PermissionRule[] {
    const rules: PermissionRule[] = [];

    // Only leads can post (participants cannot post)
    rules.push({
      role: 'participant',
      action: ActionType.POST_PUBLICATION,
      allowed: false,
    });

    rules.push({
      role: 'participant',
      action: ActionType.CREATE_POLL,
      allowed: false,
    });

    // Everyone can vote (self-voting requires wallet, enforced in VoteService)
    rules.push({
      role: 'viewer',
      action: ActionType.VOTE,
      allowed: true,
    });

    rules.push({
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
    });

    rules.push({
      role: 'lead',
      action: ActionType.VOTE,
      allowed: true,
    });

    // Everyone can view
    rules.push({
      role: 'viewer',
      action: ActionType.VIEW_COMMUNITY,
      allowed: true,
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
      startingMerits: 100,
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

      case 'team-projects':
        return {
          ...baseDefaults,
          dailyQuota: 10, // 10 comments per day (or 100, as requested)
          quotaRecipients: ['superadmin', 'lead', 'participant', 'viewer'], // Everyone gets quota for voting
          canEarn: false, // No merits earned from posts
          canSpend: false, // No merits spent on posts
        };

      default:
        return baseDefaults;
    }
  }

  /**
   * Get default voting settings based on community typeTag
   * NOTE: Self-voting restrictions are now handled via currency constraints (wallet-only) in VoteService.
   * 'not-same-team' restriction is handled as a permission block in Factor 1 (Role Hierarchy).
   */
  getDefaultVotingSettings(typeTag?: string): CommunityVotingSettings {
    const baseSettings: CommunityVotingSettings = {
      spendsMerits: true,
      awardsMerits: true,
      votingRestriction: 'any', // Self-voting allowed with wallet-only (enforced in VoteService via currency constraint)
      // meritConversion is optional and community-specific
    };

    // Team Projects: no merits earned or spent (just commenting/discussion)
    if (typeTag === 'team-projects') {
      return {
        ...baseSettings,
        spendsMerits: false, // No merits spent when voting
        awardsMerits: false, // No merits earned from votes
      };
    }

    return baseSettings;
  }
}

