import { Injectable, Logger } from '@nestjs/common';
import { CommunityService } from '../community.service';
import { MeritDestinationResult, VoteFactorContext } from './vote-factor.types';

/**
 * Factor 4: Merit Destination
 * 
 * Routes merits to correct wallets after vote.
 * Determines where merits go based on community type and settings.
 * 
 * Respects DB settings: votingSettings.meritConversion, votingSettings.awardsMerits
 */
@Injectable()
export class MeritDestinationFactor {
  private readonly logger = new Logger(MeritDestinationFactor.name);

  constructor(
    private communityService: CommunityService,
  ) {}

  /**
   * Evaluate merit destination
   * 
   * Logic:
   * - Regular groups → Same community wallet
   * - Marathon of Good → Future Vision wallet (not Marathon wallet)
   * - Future Vision → No accumulation (empty destinations)
   * - Team communities → Team community wallet only
   * 
   * @param context Vote factor context
   * @param amount Merit amount to route
   * @returns Merit destination result
   */
  async evaluate(
    context: VoteFactorContext,
    amount: number,
  ): Promise<MeritDestinationResult> {
    const { community, effectiveBeneficiaryId } = context;

    if (!community || !effectiveBeneficiaryId || amount <= 0) {
      return { destinations: [] };
    }

    // Get effective voting settings (DB overrides defaults)
    const effectiveVotingSettings = this.communityService.getEffectiveVotingSettings(community);

    // Check if merits are awarded
    if (!effectiveVotingSettings.awardsMerits) {
      this.logger.debug(
        `[evaluate] Merits not awarded: awardsMerits=false, community=${community.id}`,
      );
      return { destinations: [] };
    }

    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    // Check for custom merit conversion (DB override)
    if (effectiveVotingSettings.meritConversion) {
      const targetCommunityId = effectiveVotingSettings.meritConversion.targetCommunityId;
      const ratio = effectiveVotingSettings.meritConversion.ratio || 1;
      const convertedAmount = amount * ratio;

      const targetCommunity = await this.communityService.getCommunity(targetCommunityId);
      if (targetCommunity) {
        const targetCurrency = targetCommunity.settings?.currencyNames || currency;
        
        this.logger.debug(
          `[evaluate] Custom merit conversion: community=${community.id} → target=${targetCommunityId}, amount=${amount} → ${convertedAmount} (ratio=${ratio})`,
        );
        return {
          destinations: [{
            userId: effectiveBeneficiaryId,
            communityId: targetCommunityId,
            amount: convertedAmount,
            currency: targetCurrency,
          }],
        };
      }
    }

    // Marathon of Good → Future Vision wallet (not Marathon wallet)
    if (community.typeTag === 'marathon-of-good') {
      const futureVisionCommunity = await this.communityService.getCommunityByTypeTag('future-vision');
      
      if (futureVisionCommunity) {
        const fvCurrency = futureVisionCommunity.settings?.currencyNames || currency;
        
        this.logger.debug(
          `[evaluate] Marathon of Good → Future Vision wallet: community=${community.id} → fv=${futureVisionCommunity.id}, amount=${amount}`,
        );
        return {
          destinations: [{
            userId: effectiveBeneficiaryId,
            communityId: futureVisionCommunity.id,
            amount,
            currency: fvCurrency,
          }],
        };
      }
    }

    // Future Vision → No accumulation (empty destinations)
    if (community.typeTag === 'future-vision') {
      this.logger.debug(
        `[evaluate] Future Vision → No accumulation: community=${community.id}`,
      );
      return { destinations: [] };
    }

    // Team communities → Team community wallet only
    if (community.typeTag === 'team') {
      this.logger.debug(
        `[evaluate] Team community → Team wallet: community=${community.id}, amount=${amount}`,
      );
      return {
        destinations: [{
          userId: effectiveBeneficiaryId,
          communityId: community.id,
          amount,
          currency,
        }],
      };
    }

    // Regular groups → Same community wallet
    this.logger.debug(
      `[evaluate] Regular group → Same community wallet: community=${community.id}, amount=${amount}`,
    );
    return {
      destinations: [{
        userId: effectiveBeneficiaryId,
        communityId: community.id,
        amount,
        currency,
      }],
    };
  }
}
