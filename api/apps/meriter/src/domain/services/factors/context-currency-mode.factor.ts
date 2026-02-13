import { Injectable, Logger } from '@nestjs/common';
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
   * 1. currencySource from votingSettings (if set) → quota-only / wallet-only / quota-and-wallet
   * 2. Marathon of Good + post/comment → quota-only (backward compatibility)
   * 3. Future Vision + post/comment → wallet-only (backward compatibility)
   * 4. Project → wallet-only
   * 5. Poll → wallet-only
   * 6. Downvote → wallet-only
   * 7. Viewer role → quota-only (if role in quotaRecipients)
   * 8. Default → both-allowed (quota preferred)
   * 
   * @param context Vote factor context
   * @returns Context currency mode result
   */
  async evaluate(context: VoteFactorContext): Promise<ContextCurrencyModeResult> {
    const { community, targetType, postType, isProject, direction, userRole } = context;

    if (!community) {
      throw new Error('Community is required for context currency mode evaluation');
    }

    const isProjectContent = postType === 'project' || isProject === true;
    // Note: Polls are handled separately via polls router, not through vote service
    // The vote service only handles targetType 'publication' | 'vote' (where 'vote' means comment)
    const isPoll = false;
    const isDownvote = direction === 'down';
    // Note: viewer role removed - all users are now participants

    // Priority 1: currencySource from votingSettings (if set)
    const currencySource = community.votingSettings?.currencySource;
    if (currencySource && (targetType === 'publication' || targetType === 'vote')) {
      if (currencySource === 'quota-only') {
        this.logger.debug(
          `[evaluate] currencySource=quota-only: community=${community.id}`,
        );
        return {
          allowedQuota: true,
          allowedWallet: false,
          requiredCurrency: 'quota',
          reason: 'Community voting settings allow quota-only voting',
        };
      } else if (currencySource === 'wallet-only') {
        this.logger.debug(
          `[evaluate] currencySource=wallet-only: community=${community.id}`,
        );
        return {
          allowedQuota: false,
          allowedWallet: true,
          requiredCurrency: 'wallet',
          reason: 'Community voting settings allow wallet-only voting',
        };
      } else if (currencySource === 'quota-and-wallet') {
        // Continue to check other priorities
        // But allow both quota and wallet
      }
    }

    // Priority 2: Marathon of Good — with global merit, quota disabled in MVP; wallet (global) is used.
    // No quota-only restriction.

    // Priority 3: Future Vision + post/comment → wallet-only (backward compatibility)
    const isFutureVision = community.typeTag === 'future-vision';
    if (isFutureVision && (targetType === 'publication' || targetType === 'vote') && !currencySource) {
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
    // Note: Polls are not handled through vote service, so this should never be true
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

    // Note: Viewer role removed - all users are now participants

    // Priority 7: Default → both-allowed (quota preferred)
    // Also check if role is in quotaRecipients for quota allowance
    const effectiveMeritSettings = this.communityService.getEffectiveMeritSettings(community);
    const quotaRecipients = effectiveMeritSettings?.quotaRecipients ?? [];
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
