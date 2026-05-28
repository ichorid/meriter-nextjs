import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  executeBirzhaSourcePublish,
  type PublishCommunityToBirzhaInput,
  type PublishToBirzhaCoreDeps,
  type PublishToBirzhaResult,
} from '../projects/publish-project-to-birzha.use-case';

/**
 * BC-08: eligible local community Birzha publication.
 * inv-07: community source-entity admin verified before CommunityWallet debit.
 * inv-08: eligibility, authorization, and validation before persistence and fee debits.
 */
export class PublishCommunityToBirzhaUseCase {
  private readonly logger = new Logger(PublishCommunityToBirzhaUseCase.name);

  constructor(private readonly deps: PublishToBirzhaCoreDeps) {}

  /** inv-07: only community administrators may publish on behalf of the source. */
  private async assertSourceEntityAdmin(callerId: string, communityId: string): Promise<void> {
    if (!(await this.deps.communityService.isUserAdmin(communityId, callerId))) {
      throw new ForbiddenException('You are not allowed to publish on behalf of this source');
    }
  }

  private resolveCommunityInvesting(
    input: PublishCommunityToBirzhaInput,
    minPct: number,
    maxPct: number,
  ): { investingEnabled: boolean; investorSharePercent: number } {
    if (input.investingEnabled === false) {
      return { investingEnabled: false, investorSharePercent: 0 };
    }

    const raw = input.investorSharePercent ?? minPct;
    if (raw < minPct || raw > maxPct) {
      throw new BadRequestException(
        `investorSharePercent must be between ${minPct} and ${maxPct}`,
      );
    }

    return {
      investingEnabled: raw > 0,
      investorSharePercent: raw,
    };
  }

  async execute(input: PublishCommunityToBirzhaInput): Promise<PublishToBirzhaResult> {
    await this.assertSourceEntityAdmin(input.callerId, input.communityId);

    const source = await this.deps.communityService.getCommunity(input.communityId);
    if (!source) {
      throw new NotFoundException('Source community not found');
    }

    this.deps.communityService.assertEligibleCommunitySourceForBirzhaPublish(source);

    const birzha = await this.deps.communityService.getCommunityByTypeTag('marathon-of-good');
    if (!birzha) {
      throw new NotFoundException('Birzha community (marathon-of-good) not found');
    }

    const minPct = birzha.settings?.investorShareMin ?? 1;
    const maxPct = birzha.settings?.investorShareMax ?? 99;
    const investing = this.resolveCommunityInvesting(input, minPct, maxPct);

    const result = await executeBirzhaSourcePublish(this.deps, {
      sourceEntityId: input.communityId,
      sourceEntityType: 'community',
      callerId: input.callerId,
      content: input.content,
      type: input.type,
      title: input.title,
      description: input.description,
      images: input.images,
      valueTags: input.valueTags,
      hashtags: input.hashtags,
      beneficiaryId: input.beneficiaryId,
      postCostFunding: input.postCostFunding,
      investing,
      ttlDays: input.ttlDays,
      stopLoss: input.stopLoss,
      noAuthorWalletSpend: input.noAuthorWalletSpend,
    });

    this.logger.log(`Birzha publication from community ${input.communityId}: ${result.id}`);
    return result;
  }
}

export function createPublishCommunityToBirzhaUseCase(
  deps: PublishToBirzhaCoreDeps,
): PublishCommunityToBirzhaUseCase {
  return new PublishCommunityToBirzhaUseCase(deps);
}

export type { PublishCommunityToBirzhaInput, PublishToBirzhaResult };
