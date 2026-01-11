import { Injectable, Logger } from '@nestjs/common';
import { COMMUNITY_ROLE_VIEWER } from '../../common/constants/roles.constants';
import { CommunityService } from '../community.service';
import { ContextCurrencyModeResult, VoteFactorContext } from './vote-factor.types';

/**
 * Factor 3: Context Currency Mode
 * 
 * Context-based currency rules (WHAT/WHERE you're voting).
 * Determines quota vs wallet constraints based on community type, content type, direction, and role.
 * 
 * Respects DB settings: meritSettings.quotaRecipients
 */
@Injectable()
export class ContextCurrencyModeFactor {
  private readonly logger = new Logger(ContextCurrencyModeFactor.name);

  constructor(
    private communityService: CommunityService,
  ) {}

  /**
   * Evaluate context currency mode
   * 
   * Priority order (first match wins):
   * 1. Marathon of Good + post/comment → quota-only
   * 2. Future Vision + post/comment → wallet-only
   * 3. Project → wallet-only
   * 4. Poll → wallet-only
   * 5. Downvote → wallet-only
   * 6. Viewer role → quota-only (if role in quotaRecipients)
   * 7. Default → both-allowed (quota preferred)
   * 
   * @param context Vote factor context
   * @returns Context currency mode result
   */
  async evaluate(context: VoteFactorContext): Promise<ContextCurrencyModeResult> {
    const { community, targetType, postType, isProject, direction, userRole } = context;

    if (!community) {
      throw new Error('Community is required for context currency mode evaluation');
    }

    const isMarathonOfGood = community.typeTag === 'marathon-of-good';
    const isFutureVision = community.typeTag === 'future-vision';
    const isProjectContent = postType === 'project' || isProject === true;
    const isPoll = targetType === 'vote'; // Voting on votes/comments (polls)
    const isDownvote = direction === 'down';
    const isViewer = userRole === COMMUNITY_ROLE_VIEWER;

    // Priority 1: Marathon of Good + post/comment → quota-only
    if (isMarathonOfGood && (targetType === 'publication' || targetType === 'vote')) {
      this.logger.debug(
        `[evaluate] Marathon of Good + post/comment → quota-only: community=${community.id}`,
      );
      return {
        allowedQuota: true,
        allowedWallet: false,
        requiredCurrency: 'quota',
        reason: 'Marathon of Good only allows quota voting on posts and comments',
      };
    }

    // Priority 2: Future Vision + post/comment → wallet-only
    if (isFutureVision && (targetType === 'publication' || targetType === 'vote')) {
      this.logger.debug(
        `[evaluate] Future Vision + post/comment → wallet-only: community=${community.id}`,
      );
      return {
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: 'Future Vision only allows wallet voting on posts and comments',
      };
    }

    // Priority 3: Project → wallet-only
    if (isProjectContent) {
      this.logger.debug(
        `[evaluate] Project → wallet-only: postType=${postType}, isProject=${isProject}`,
      );
      return {
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: 'Projects can only be voted on with Merits (Wallet), not Daily Quota',
      };
    }

    // Priority 4: Poll → wallet-only
    if (isPoll) {
      this.logger.debug(
        `[evaluate] Poll → wallet-only: targetType=${targetType}`,
      );
      return {
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: 'Polls can only be voted on with wallet merits',
      };
    }

    // Priority 5: Downvote → wallet-only
    if (isDownvote) {
      this.logger.debug(
        `[evaluate] Downvote → wallet-only: direction=${direction}`,
      );
      return {
        allowedQuota: false,
        allowedWallet: true,
        requiredCurrency: 'wallet',
        reason: 'Downvotes can only be made with wallet merits',
      };
    }

    // Priority 6: Viewer role → quota-only (if role in quotaRecipients)
    if (isViewer) {
      // Get effective merit settings (DB overrides defaults)
      const effectiveMeritSettings = this.communityService.getEffectiveMeritSettings(community);
      const quotaRecipients = effectiveMeritSettings.quotaRecipients || [];
      
      // Only allow quota if viewer is in quotaRecipients list
      if (quotaRecipients.includes('viewer')) {
        this.logger.debug(
          `[evaluate] Viewer role → quota-only: userRole=${userRole}, quotaRecipients includes viewer`,
        );
        return {
          allowedQuota: true,
          allowedWallet: false,
          requiredCurrency: 'quota',
          reason: 'Viewers can only vote using daily quota, not wallet merits',
        };
      } else {
        // Viewer not in quotaRecipients → cannot vote at all (this should be caught by Factor 1, but return both false)
        return {
          allowedQuota: false,
          allowedWallet: false,
          reason: 'Viewers are not allowed to vote (not in quotaRecipients)',
        };
      }
    }

    // Priority 7: Default → both-allowed (quota preferred)
    // Also check if role is in quotaRecipients for quota allowance
    const effectiveMeritSettings = this.communityService.getEffectiveMeritSettings(community);
    const quotaRecipients = effectiveMeritSettings.quotaRecipients || [];
    const canUseQuota = userRole ? quotaRecipients.includes(userRole) : true;
    
    this.logger.debug(
      `[evaluate] Default → both-allowed: userRole=${userRole}, canUseQuota=${canUseQuota}`,
    );
    return {
      allowedQuota: canUseQuota,
      allowedWallet: true,
      // No requiredCurrency - user can choose
    };
  }
}
