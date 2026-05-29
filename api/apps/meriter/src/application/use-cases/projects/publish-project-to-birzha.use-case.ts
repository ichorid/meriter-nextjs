import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import { PublicationCreatedEvent } from '../../../domain/events';
import type { EventBus } from '../../../domain/events/event-bus';
import type { PublicationPersistencePort } from '../../../domain/ports/publication.persistence.port';
import type { CommunityService } from '../../../domain/services/community.service';
import type { CommunityWalletService } from '../../../domain/services/community-wallet.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import { PublicationId } from '../../../domain/value-objects';
import type {
  PublishCommunityToBirzhaInput,
  PublishProjectToBirzhaInput,
  PublishProjectToBirzhaPort,
  PublishToBirzhaBaseInput,
  PublishToBirzhaResult,
} from '../../../domain/ports/publish-to-birzha.port';

export type {
  PublishCommunityToBirzhaInput,
  PublishProjectToBirzhaInput,
  PublishSourceEntityToBirzhaParams,
  PublishToBirzhaBaseInput,
  PublishToBirzhaResult,
} from '../../../domain/ports/publish-to-birzha.port';

export type PublishToBirzhaCoreDeps = {
  publicationPersistence: PublicationPersistencePort;
  eventBus: EventBus;
  communityService: CommunityService;
  userService: UserService;
  communityWalletService: CommunityWalletService;
  walletService: WalletService;
};

type ResolvedInvesting = {
  investingEnabled: boolean;
  investorSharePercent: number;
};

/**
 * Shared Birzha publish orchestration after source-specific validation (BC-08).
 * inv-08: caller must already be authorized; postCost debited before persistence.
 */
export async function executeBirzhaSourcePublish(
  deps: PublishToBirzhaCoreDeps,
  params: {
    sourceEntityId: string;
    sourceEntityType: 'project' | 'community';
    callerId: string;
    content: string;
    type: 'text' | 'image' | 'video';
    title: string;
    description?: string;
    images?: string[];
    valueTags?: string[];
    hashtags?: string[];
    beneficiaryId?: string;
    postCostFunding?: 'source_community_wallet' | 'caller_global_wallet';
    investing: ResolvedInvesting;
    ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
    stopLoss?: number;
    noAuthorWalletSpend?: boolean;
  },
): Promise<PublishToBirzhaResult> {
  const birzha = await deps.communityService.getCommunityByTypeTag('marathon-of-good');
  if (!birzha) {
    throw new NotFoundException('Birzha community (marathon-of-good) not found');
  }

  if (params.beneficiaryId) {
    const beneficiaryUser = await deps.userService.getUserById(params.beneficiaryId);
    if (!beneficiaryUser) {
      throw new BadRequestException('Beneficiary must be a registered user');
    }
  }

  const requireTTLForInvestPosts = birzha.settings?.requireTTLForInvestPosts ?? false;
  if (requireTTLForInvestPosts && params.investing.investingEnabled) {
    if (params.ttlDays == null || params.ttlDays === undefined) {
      throw new BadRequestException('TTL is required for posts with investing on Birzha');
    }
  }

  const stopLoss = params.stopLoss ?? 0;
  if (stopLoss < 0) {
    throw new BadRequestException('stopLoss must be 0 or greater');
  }

  const id = PublicationId.generate().getValue();
  const postCost = birzha.settings?.postCost ?? 1;
  const funding = params.postCostFunding ?? 'source_community_wallet';

  await deps.communityWalletService.createWallet(params.sourceEntityId);

  if (postCost > 0) {
    if (funding === 'source_community_wallet') {
      await deps.communityWalletService.deductBalance(
        params.sourceEntityId,
        postCost,
        'birzha_post_cost',
      );
    } else {
      const wallet = await deps.walletService.getWallet(params.callerId, GLOBAL_COMMUNITY_ID);
      const balance = wallet ? wallet.getBalance() : 0;
      if (balance < postCost) {
        throw new BadRequestException(
          `Insufficient wallet merits. Available: ${balance}, Required: ${postCost}`,
        );
      }
      const globalCommunity = await deps.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
      const feeCurrency = globalCommunity?.settings?.currencyNames || {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      };
      await deps.walletService.addTransaction(
        params.callerId,
        GLOBAL_COMMUNITY_ID,
        'debit',
        postCost,
        'personal',
        'publication_creation',
        id,
        feeCurrency,
        'Payment for publishing to Birzha (personal wallet)',
      );
    }
  }

  const now = new Date();
  const birzhaId = birzha.id as string;
  const ttlDays = params.ttlDays ?? null;
  const ttlExpiresAt =
    ttlDays != null && ttlDays > 0
      ? new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
      : null;

  const { investingEnabled, investorSharePercent } = params.investing;

  await deps.publicationPersistence.insertPublication({
    id,
    communityId: birzhaId,
    authorId: params.callerId,
    authorKind: 'community',
    authoredCommunityId: params.sourceEntityId,
    publishedByUserId: params.callerId,
    sourceEntityId: params.sourceEntityId,
    sourceEntityType: params.sourceEntityType,
    beneficiaryId: params.beneficiaryId,
    content: params.content,
    type: params.type,
    title: params.title,
    description: params.description,
    hashtags: params.hashtags ?? [],
    categories: [],
    valueTags: params.valueTags ?? [],
    images: params.images ?? [],
    metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
    investingEnabled,
    investorSharePercent: investingEnabled ? investorSharePercent : undefined,
    investmentPool: 0,
    investmentPoolTotal: 0,
    investments: [],
    ttlDays: ttlDays ?? undefined,
    ttlExpiresAt,
    stopLoss,
    noAuthorWalletSpend: params.noAuthorWalletSpend ?? false,
    status: 'active',
    postType: 'basic',
    isProject: false,
    createdAt: now,
    updatedAt: now,
  });

  await deps.eventBus.publish(new PublicationCreatedEvent(id, params.callerId, birzhaId));

  return { id };
}

/**
 * BC-08: cooperative project Birzha publication.
 * inv-07: project source-entity admin verified before CommunityWallet debit.
 * inv-08: authorization and validation before persistence and fee debits.
 */
export class PublishProjectToBirzhaUseCase implements PublishProjectToBirzhaPort {
  private readonly logger = new Logger(PublishProjectToBirzhaUseCase.name);

  constructor(private readonly deps: PublishToBirzhaCoreDeps) {}

  /** inv-07: only project administrators may publish on behalf of the project. */
  private async assertSourceEntityAdmin(callerId: string, projectId: string): Promise<void> {
    if (!(await this.deps.communityService.isUserAdmin(projectId, callerId))) {
      throw new ForbiddenException('You are not allowed to publish on behalf of this source');
    }
  }

  private resolveProjectInvesting(
    input: PublishProjectToBirzhaInput,
    source: NonNullable<Awaited<ReturnType<CommunityService['getCommunity']>>>,
    minPct: number,
    maxPct: number,
  ): ResolvedInvesting {
    if (input.investingEnabled === false) {
      return { investingEnabled: false, investorSharePercent: 0 };
    }

    const raw = input.investorSharePercent ?? source.investorSharePercent ?? minPct;
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

  async execute(input: PublishProjectToBirzhaInput): Promise<PublishToBirzhaResult> {
    await this.assertSourceEntityAdmin(input.callerId, input.projectId);

    const source = await this.deps.communityService.getCommunity(input.projectId);
    if (!source) {
      throw new NotFoundException('Source community not found');
    }
    if (!source.isProject) {
      throw new BadRequestException('Source is not a project community');
    }

    const birzha = await this.deps.communityService.getCommunityByTypeTag('marathon-of-good');
    if (!birzha) {
      throw new NotFoundException('Birzha community (marathon-of-good) not found');
    }

    const minPct = birzha.settings?.investorShareMin ?? 1;
    const maxPct = birzha.settings?.investorShareMax ?? 99;
    const investing = this.resolveProjectInvesting(input, source, minPct, maxPct);

    const result = await executeBirzhaSourcePublish(this.deps, {
      sourceEntityId: input.projectId,
      sourceEntityType: 'project',
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

    this.logger.log(`Birzha publication from project ${input.projectId}: ${result.id}`);
    return result;
  }
}

export function createPublishProjectToBirzhaUseCase(
  deps: PublishToBirzhaCoreDeps,
): PublishProjectToBirzhaUseCase {
  return new PublishProjectToBirzhaUseCase(deps);
}
