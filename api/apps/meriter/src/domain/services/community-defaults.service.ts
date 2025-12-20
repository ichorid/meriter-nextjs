import { Injectable } from '@nestjs/common';
import type {
  CommunityPostingRules,
  CommunityVotingRules,
  CommunityVisibilityRules,
  CommunityMeritRules,
} from '../models/community/community.schema';

/**
 * CommunityDefaultsService
 *
 * Provides default rules for communities based on their typeTag.
 * Defaults are stored in-memory in code, not in the database.
 * Only custom overrides are stored in the database.
 */
@Injectable()
export class CommunityDefaultsService {
  /**
   * Get default posting rules based on community typeTag
   */
  getDefaultPostingRules(
    typeTag?: string,
  ): CommunityPostingRules {
    const baseDefaults: CommunityPostingRules = {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      requiresTeamMembership: false,
      onlyTeamLead: false,
      autoMembership: false,
    };

    switch (typeTag) {
      case 'marathon-of-good':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
          onlyTeamLead: false,
        };

      case 'future-vision':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
          onlyTeamLead: false,
        };

      case 'support':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
          requiresTeamMembership: false,
        };

      case 'team':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
          requiresTeamMembership: true,
        };

      default:
        return baseDefaults;
    }
  }

  /**
   * Get default voting rules based on community typeTag
   */
  getDefaultVotingRules(
    typeTag?: string,
  ): CommunityVotingRules {
    const baseDefaults: CommunityVotingRules = {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    };

    switch (typeTag) {
      case 'marathon-of-good':
        return {
          ...baseDefaults,
          participantsCannotVoteForLead: true,
        };

      case 'future-vision':
        return {
          ...baseDefaults,
          canVoteForOwnPosts: true,
        };

      case 'support':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
        };

      case 'team':
        return {
          ...baseDefaults,
          allowedRoles: ['superadmin', 'lead', 'participant'],
        };

      default:
        return baseDefaults;
    }
  }

  /**
   * Get default visibility rules based on community typeTag
   */
  getDefaultVisibilityRules(
    typeTag?: string,
  ): CommunityVisibilityRules {
    const baseDefaults: CommunityVisibilityRules = {
      visibleToRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      isHidden: false,
      teamOnly: false,
    };

    // All community types use the same visibility defaults for now
    return baseDefaults;
  }

  /**
   * Get default merit rules based on community typeTag
   */
  getDefaultMeritRules(
    typeTag?: string,
  ): CommunityMeritRules {
    const baseDefaults: CommunityMeritRules = {
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
}

