import { Injectable, Logger } from '@nestjs/common';
import { SocialCurrencyConstraintResult, VoteFactorContext } from './vote-factor.types';

/**
 * Factor 2: Social Currency Constraint
 * 
 * Relationship-based currency constraints (WHO you're voting for).
 * Determines if self-voting or teammate voting requires wallet-only constraint.
 * 
 * Note: This factor only applies currency constraints, NOT permission blocks.
 * Permission checks (including 'not-same-team' restriction) are handled by Factor 1.
 */
@Injectable()
export class SocialCurrencyConstraintFactor {
  private readonly logger = new Logger(SocialCurrencyConstraintFactor.name);

  /**
   * Evaluate social currency constraint
   * 
   * @param context Vote factor context
   * @returns Social currency constraint result
   */
  async evaluate(context: VoteFactorContext): Promise<SocialCurrencyConstraintResult> {
    const { userId, effectiveBeneficiaryId, community, sharedTeamCommunities } = context;

    if (!effectiveBeneficiaryId || !community) {
      return { constraint: null };
    }

    // Check if voter is the effective beneficiary (self-voting)
    const effectiveBeneficiaryIdStr = String(effectiveBeneficiaryId).trim().toLowerCase();
    const userIdStr = String(userId).trim().toLowerCase();
    const isSelfVote = effectiveBeneficiaryIdStr === userIdStr;

    // Priority 1: Self-voting → wallet-only constraint (always applies)
    if (isSelfVote) {
      this.logger.debug(
        `[evaluate] Self-voting detected: userId=${userId}, effectiveBeneficiaryId=${effectiveBeneficiaryId} → wallet-only constraint`,
      );
      return { 
        constraint: 'wallet-only',
        reason: 'Self-voting requires wallet merits only (quota cannot be used)',
      };
    }

    // Priority 2: Teammate voting in special communities (FV/MoG) → wallet-only constraint
    const isSpecialCommunity = community.typeTag === 'future-vision' || 
                                community.typeTag === 'marathon-of-good';
    
    if (isSpecialCommunity && (sharedTeamCommunities?.length ?? 0) > 0) {
      // Note: If community.votingSettings.votingRestriction === 'not-same-team',
      // this vote is already blocked by Factor 1 (permission block).
      // This factor only applies currency constraint if permission check passed.
      this.logger.debug(
        `[evaluate] Teammate voting in special community detected: community=${community.typeTag}, sharedTeamCommunities=${sharedTeamCommunities?.length} → wallet-only constraint`,
      );
      return {
        constraint: 'wallet-only',
        reason: 'Voting for teammates in special communities (Future Vision, Marathon of Good) requires wallet merits only',
      };
    }

    // No social constraint
    return { constraint: null };
  }
}
