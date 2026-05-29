import { Injectable } from '@nestjs/common';
import { ActionType } from '../common/constants/action-types.constants';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import {
  GLOBAL_COMMUNITY_BOOTSTRAP,
  PRIORITY_HUB_BOOTSTRAP_TYPE_TAGS,
} from '../common/constants/platform-bootstrap.constants';
import type {
  PermissionRule,
  CommunityMeritSettings,
  CommunityVotingSettings,
  CommunitySettings,
  CommunityCurrencyNames,
} from '../models/community/community.schema';

type CommunityRole = 'superadmin' | 'lead' | 'participant';

/** Legacy *Rules shapes still stored on some communities; used by migration scripts only. */
export interface LegacyPostingRulesForMigration {
  allowedRoles: CommunityRole[];
  requiresTeamMembership?: boolean;
  onlyTeamLead?: boolean;
  autoMembership?: boolean;
}

export interface LegacyVotingRulesForMigration {
  allowedRoles: CommunityRole[];
  canVoteForOwnPosts: boolean;
  participantsCannotVoteForLead?: boolean;
  spendsMerits: boolean;
  awardsMerits: boolean;
}

export interface LegacyVisibilityRulesForMigration {
  visibleToRoles: CommunityRole[];
  isHidden?: boolean;
  teamOnly?: boolean;
}

export interface LegacyMeritRulesForMigration {
  dailyQuota: number;
  quotaRecipients: CommunityRole[];
  canEarn: boolean;
  canSpend: boolean;
}

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
      case 'project':
        // Projects use base rules (discussions free, postCost=0 set at creation)
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
    const _roles: Array<'superadmin' | 'lead' | 'participant'> = [
      'superadmin',
      'lead',
      'participant',
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
      { role: 'lead', action: ActionType.PROPOSE_DOCUMENT_VARIANT, allowed: true },
      { role: 'lead', action: ActionType.VOTE_DOCUMENT_VARIANT, allowed: true },
      { role: 'lead', action: ActionType.APPLY_DOCUMENT_VARIANT, allowed: true },
      { role: 'lead', action: ActionType.EDIT_DOCUMENT_STRUCTURE, allowed: true },
      { role: 'lead', action: ActionType.CREATE_DOCUMENT, allowed: true },
      { role: 'lead', action: ActionType.MANAGE_DOCUMENT, allowed: true },
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
      { role: 'participant', action: ActionType.PROPOSE_DOCUMENT_VARIANT, allowed: true },
      { role: 'participant', action: ActionType.VOTE_DOCUMENT_VARIANT, allowed: true },
    );

    // Note: Viewer role has been removed. All users are now participants by default.

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

    // Note: Viewer role has been removed. All users are now participants by default.

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

    // Note: Viewer role has been removed. All users are now participants by default.

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
      role: 'participant',
      action: ActionType.VOTE,
      allowed: true,
    });

    rules.push({
      role: 'lead',
      action: ActionType.VOTE,
      allowed: true,
    });

    // Note: Viewer role has been removed. All users are now participants by default.

    return rules;
  }

  /**
   * Get default merit settings based on community typeTag
   */
  getDefaultMeritSettings(typeTag?: string): CommunityMeritSettings {
    const baseDefaults: CommunityMeritSettings = {
      dailyQuota: 10,
      quotaRecipients: ['superadmin', 'lead', 'participant'],
      canEarn: true,
      canSpend: true,
      startingMerits: 10,
      quotaEnabled: true,
    };

    switch (typeTag) {
      case 'marathon-of-good':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
        };

      case 'future-vision':
        return {
          ...baseDefaults,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
          quotaEnabled: false,
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
          dailyQuota: 10,
          startingMerits: 0,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
          canEarn: false,
          canSpend: false,
        };

      case 'project':
        return {
          ...baseDefaults,
          dailyQuota: 10,
          quotaRecipients: ['superadmin', 'lead', 'participant'],
          canEarn: true,
          canSpend: true,
          quotaEnabled: true,
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
      votingRestriction: 'any',
      allowNegativeVoting: true,
    };

    if (typeTag === 'project') {
      return {
        ...baseSettings,
        allowNegativeVoting: false,
        currencySource: 'quota-and-wallet',
      };
    }

    if (typeTag === 'future-vision') {
      return { ...baseSettings, allowNegativeVoting: true };
    }

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

  /** Canonical currency names for platform communities and wallets. */
  getStandardCurrencyNames(): CommunityCurrencyNames {
    return {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };
  }

  /**
   * Code defaults for community settings (not Mongoose schema defaults).
   * Matches CommunityService.createCommunity baseline settings.
   */
  getDefaultSettings(typeTag?: string): Partial<CommunitySettings> {
    const currencyNames = this.getStandardCurrencyNames();
    const dailyEmission =
      typeTag === 'future-vision' || typeTag === 'global' ? 0 : 10;

    return {
      currencyNames,
      dailyEmission,
      commentMode: 'all',
      documentsMode: 'visionOrDescriptionOnly',
      documentCreators: 'admins',
      documentVotingDurationHours: 48,
      documentDefaultMode: 'manual',
      documentAutoApplyTimerHours: 48,
    };
  }

  /** Priority hub typeTags consolidated into the global wallet during migration. */
  getPriorityHubTypeTags(): readonly string[] {
    return PRIORITY_HUB_BOOTSTRAP_TYPE_TAGS;
  }

  /** Seed document for the synthetic global community (__global__). */
  getGlobalCommunitySeedDocument(): {
    id: string;
    name: string;
    description: string;
    typeTag: 'global';
    members: string[];
    settings: CommunitySettings;
    hashtags: string[];
    hashtagDescriptions: Record<string, string>;
    isActive: boolean;
    isPriority: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    const now = new Date();
    const bootstrap = GLOBAL_COMMUNITY_BOOTSTRAP;
    return {
      id: GLOBAL_COMMUNITY_ID,
      name: bootstrap.name,
      description: bootstrap.description,
      typeTag: 'global',
      members: [],
      settings: {
        ...this.getDefaultSettings('global'),
        ...bootstrap.settings,
      } as CommunitySettings,
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true,
      isPriority: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Migration-only: legacy postingRules shape derived from permission defaults. */
  getLegacyPostingRulesForMigration(typeTag?: string): LegacyPostingRulesForMigration {
    const rules = this.getDefaultPermissionRules(typeTag);
    const allowedRoles = (['superadmin', 'lead', 'participant'] as const).filter(
      (role) =>
        rules.find(
          (rule) =>
            rule.role === role && rule.action === ActionType.POST_PUBLICATION && rule.allowed,
        ),
    );
    const participantPost = rules.find(
      (rule) =>
        rule.role === 'participant' && rule.action === ActionType.POST_PUBLICATION,
    );

    return {
      allowedRoles: [...allowedRoles],
      requiresTeamMembership:
        participantPost?.conditions?.requiresTeamMembership ?? false,
      onlyTeamLead: participantPost?.conditions?.onlyTeamLead ?? false,
      autoMembership: false,
    };
  }

  /** Migration-only: legacy votingRules shape derived from permission + voting defaults. */
  getLegacyVotingRulesForMigration(typeTag?: string): LegacyVotingRulesForMigration {
    const rules = this.getDefaultPermissionRules(typeTag);
    const voting = this.getDefaultVotingSettings(typeTag);
    const allowedRoles = (['superadmin', 'lead', 'participant'] as const).filter(
      (role) =>
        rules.find(
          (rule) => rule.role === role && rule.action === ActionType.VOTE && rule.allowed,
        ),
    );
    const participantVote = rules.find(
      (rule) => rule.role === 'participant' && rule.action === ActionType.VOTE,
    );

    return {
      allowedRoles: [...allowedRoles],
      canVoteForOwnPosts: participantVote?.conditions?.canVoteForOwnPosts ?? false,
      participantsCannotVoteForLead:
        participantVote?.conditions?.participantsCannotVoteForLead ?? false,
      spendsMerits: voting.spendsMerits,
      awardsMerits: voting.awardsMerits,
    };
  }

  /** Migration-only: legacy visibilityRules baseline (viewer role removed). */
  getLegacyVisibilityRulesForMigration(_typeTag?: string): LegacyVisibilityRulesForMigration {
    return {
      visibleToRoles: ['superadmin', 'lead', 'participant'],
      isHidden: false,
      teamOnly: false,
    };
  }

  /** Migration-only: legacy meritRules shape derived from meritSettings defaults. */
  getLegacyMeritRulesForMigration(typeTag?: string): LegacyMeritRulesForMigration {
    const merit = this.getDefaultMeritSettings(typeTag);
    return {
      dailyQuota: merit.dailyQuota,
      quotaRecipients: merit.quotaRecipients,
      canEarn: merit.canEarn,
      canSpend: merit.canSpend,
    };
  }
}

