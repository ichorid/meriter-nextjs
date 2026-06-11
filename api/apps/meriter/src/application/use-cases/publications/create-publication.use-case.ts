import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Connection } from 'mongoose';
import { Publication } from '../../../domain/aggregates/publication/publication.entity';
import { GLOBAL_COMMUNITY_ID } from '../../../domain/common/constants/global.constant';
import { PublicationCreatedEvent } from '../../../domain/events';
import type { EventBus } from '../../../domain/events/event-bus';
import type { PublicationPersistencePort } from '../../../domain/ports/publication.persistence.port';
import type { CommunityService } from '../../../domain/services/community.service';
import type { CommunityWalletService } from '../../../domain/services/community-wallet.service';
import type { PermissionService } from '../../../domain/services/permission.service';
import type {
  CreatePublicationDto,
} from '../../../domain/services/publication.service';
import type { UserCommunityRoleService } from '../../../domain/services/user-community-role.service';
import type { UserService } from '../../../domain/services/user.service';
import type { WalletService } from '../../../domain/services/wallet.service';
import type { WalletContextResolverService } from '../../../domain/services/wallet-context-resolver.service';
import { CommunityId, UserId } from '../../../domain/value-objects';
import type {
  CreatePublicationExecuteOptions,
  CreatePublicationPort,
} from '../../../domain/ports/create-publication.port';
import {
  createGetRemainingQuotaUseCase,
  type CommunityQuotaContext,
} from '../wallets/get-remaining-quota.use-case';

export type { CreatePublicationExecuteOptions } from '../../../domain/ports/create-publication.port';

type PostCostBreakdown = {
  postCost: number;
  quotaAmount: number;
  walletAmount: number;
  payFromCommunityWallet: boolean;
  communityWalletSourceId?: string;
};

/**
 * BC-03: publication creation orchestration.
 * inv-01: postCost wallet portion debited from GLOBAL_COMMUNITY_ID via WalletService.
 * inv-07: community source-entity posts require lead of sourceEntityId.
 * inv-08: permission checks before persistence and fee debits.
 */
export class CreatePublicationUseCase implements CreatePublicationPort {
  private readonly logger = new Logger(CreatePublicationUseCase.name);
  private readonly getRemainingQuota: ReturnType<typeof createGetRemainingQuotaUseCase>;

  constructor(
    private readonly publicationPersistence: PublicationPersistencePort,
    private readonly connection: Connection,
    private readonly eventBus: EventBus,
    private readonly permissionService: PermissionService,
    private readonly communityService: CommunityService,
    private readonly userCommunityRoleService: UserCommunityRoleService,
    private readonly userService: UserService,
    private readonly communityWalletService: CommunityWalletService,
    private readonly walletService: WalletService,
    private readonly walletContextResolverService: WalletContextResolverService,
  ) {
    this.getRemainingQuota = createGetRemainingQuotaUseCase({
      communityService: this.communityService,
    });
  }

  private async assertCanCreate(userId: string, communityId: string): Promise<void> {
    const allowed = await this.permissionService.canCreatePublication(userId, communityId);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to create publications in this community');
    }
  }

  /** inv-07: posting as a community source requires lead of that community. */
  private assertInvestingAndTtlRules(
    dto: CreatePublicationDto,
    community: NonNullable<Awaited<ReturnType<CommunityService['getCommunity']>>>,
  ): void {
    if (dto.investingEnabled) {
      const investingEnabled = community.settings?.investingEnabled ?? false;
      if (!investingEnabled) {
        throw new BadRequestException('Investing is not enabled for this community');
      }
      const min = community.settings?.investorShareMin ?? 1;
      const max = community.settings?.investorShareMax ?? 99;
      const percent = dto.investorSharePercent;
      if (percent == null || percent < min || percent > max) {
        throw new BadRequestException(
          `Investor share must be between ${min}% and ${max}%`,
        );
      }
    }

    const requireTTLForInvestPosts =
      community.settings?.requireTTLForInvestPosts ?? false;
    if (requireTTLForInvestPosts && dto.investingEnabled) {
      if (dto.ttlDays == null || dto.ttlDays === undefined) {
        throw new BadRequestException(
          'Posts with investing enabled must have a TTL (time to live) set in this community',
        );
      }
    }

    if (dto.ttlDays != null) {
      const maxTTL = community.settings?.maxTTL;
      if (maxTTL != null && dto.ttlDays > maxTTL) {
        throw new BadRequestException(
          `TTL cannot exceed ${maxTTL} days in this community`,
        );
      }
    }
  }

  private async assertSourceEntityLead(userId: string, sourceEntityId: string): Promise<void> {
    const role = await this.userCommunityRoleService.getRole(userId, sourceEntityId);
    if (role?.role !== 'lead') {
      throw new ForbiddenException(
        'Only the community lead can publish on behalf of the community',
      );
    }
  }

  private async resolvePostCostBreakdown(
    userId: string,
    dto: CreatePublicationDto,
    community: NonNullable<Awaited<ReturnType<CommunityService['getCommunity']>>>,
    postingAsCommunity: boolean,
  ): Promise<PostCostBreakdown> {
    const postCost = community.settings?.postCost ?? 1;
    const canPayFromQuota = community.settings?.canPayPostFromQuota ?? false;
    const payFromCommunityWallet =
      postingAsCommunity &&
      !!dto.sourceEntityId &&
      (dto.postCostFunding ?? 'source_community_wallet') === 'source_community_wallet';

    let quotaAmount = 0;
    let walletAmount = 0;

    if (postCost <= 0) {
      return {
        postCost,
        quotaAmount: 0,
        walletAmount: 0,
        payFromCommunityWallet: false,
      };
    }

    if (payFromCommunityWallet && dto.sourceEntityId) {
      const communityWalletKey =
        await this.walletContextResolverService.resolveCommunityWalletCommunityId(
          dto.sourceEntityId,
        );
      await this.communityWalletService.createWallet(communityWalletKey);
      const cw = await this.communityWalletService.getWallet(communityWalletKey);
      const communityBal = cw?.balance ?? 0;
      if (communityBal < postCost) {
        throw new BadRequestException(
          `Insufficient community wallet merits. Available: ${communityBal}, Required: ${postCost}`,
        );
      }
      return {
        postCost,
        quotaAmount: 0,
        walletAmount: 0,
        payFromCommunityWallet: true,
        communityWalletSourceId: communityWalletKey,
      };
    }

    if (canPayFromQuota) {
      const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
        userId,
        communityId: dto.communityId,
        community: community as CommunityQuotaContext,
        db: this.connection.db!,
      });
      quotaAmount = Math.min(postCost, remainingQuota);
      walletAmount = Math.max(0, postCost - quotaAmount);
    } else {
      walletAmount = postCost;
    }

    if (walletAmount > 0) {
      const wallet = await this.walletService.getWallet(userId, GLOBAL_COMMUNITY_ID);
      const walletBalance = wallet ? wallet.getBalance() : 0;
      if (walletBalance < walletAmount) {
        throw new BadRequestException(
          `Insufficient wallet merits. Available: ${walletBalance}, Required: ${walletAmount}`,
        );
      }
    }

    if (quotaAmount > 0) {
      const remainingQuota = await this.getRemainingQuota.forPublicationCreate({
        userId,
        communityId: dto.communityId,
        community: community as CommunityQuotaContext,
        db: this.connection.db!,
      });
      if (remainingQuota < quotaAmount) {
        throw new BadRequestException(
          `Insufficient quota. Available: ${remainingQuota}, Required: ${quotaAmount}`,
        );
      }
    }

    return {
      postCost,
      quotaAmount,
      walletAmount,
      payFromCommunityWallet: false,
    };
  }

  private async applyPostCost(
    userId: string,
    publicationId: string,
    communityId: string,
    breakdown: PostCostBreakdown,
    currency: { singular: string; plural: string; genitive: string },
  ): Promise<void> {
    if (breakdown.postCost <= 0) {
      return;
    }

    if (breakdown.payFromCommunityWallet && breakdown.communityWalletSourceId) {
      await this.communityWalletService.createWallet(breakdown.communityWalletSourceId);
      await this.communityWalletService.deductBalance(
        breakdown.communityWalletSourceId,
        breakdown.postCost,
        'publication_post_cost',
      );
      return;
    }

    if (breakdown.quotaAmount > 0) {
      if (!this.connection.db) {
        throw new Error('Database connection not available');
      }
      await this.connection.db.collection('quota_usage').insertOne({
        id: `quota_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        communityId,
        amountQuota: breakdown.quotaAmount,
        usageType: 'publication_creation',
        referenceId: publicationId,
        createdAt: new Date(),
      });
    }

    if (breakdown.walletAmount > 0) {
      const globalCommunity = await this.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
      const feeCurrency = globalCommunity?.settings?.currencyNames || currency;
      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'debit',
        breakdown.walletAmount,
        'personal',
        'publication_creation',
        publicationId,
        feeCurrency,
        'Payment for creating publication',
      );
    }
  }

  async execute(
    userId: string,
    dto: CreatePublicationDto,
    options: CreatePublicationExecuteOptions = {},
  ): Promise<Publication> {
    const checkPermissions = options.checkPermissions ?? true;
    const processPostCost = options.processPostCost ?? dto.processPostCost ?? false;

    this.logger.log(
      `Creating publication: user=${userId}, community=${dto.communityId}`,
    );

    if (checkPermissions) {
      await this.assertCanCreate(userId, dto.communityId);
    }

    const postingAsCommunity =
      dto.sourceEntityType === 'community' && !!dto.sourceEntityId;

    if (postingAsCommunity && dto.sourceEntityId) {
      await this.assertSourceEntityLead(userId, dto.sourceEntityId);
    }

    const authorId = UserId.fromString(userId);
    CommunityId.fromString(dto.communityId);

    const community = await this.communityService.getCommunity(dto.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    this.assertInvestingAndTtlRules(dto, community);

    if (community.isProject) {
      if (
        dto.postType !== 'ticket' &&
        dto.postType !== 'discussion' &&
        dto.postType !== 'event'
      ) {
        throw new BadRequestException(
          'When creating a post in a project community, postType must be "ticket", "discussion", or "event"',
        );
      }
      const role = await this.userCommunityRoleService.getRole(userId, dto.communityId);
      if (!role) {
        throw new BadRequestException('Only project members can create posts');
      }
      if (dto.postType === 'ticket' && role.role !== 'lead') {
        throw new BadRequestException('Only the project lead can create tickets');
      }
    }

    if (dto.beneficiaryId) {
      const beneficiaryUser = await this.userService.getUserById(dto.beneficiaryId);
      if (!beneficiaryUser) {
        throw new BadRequestException('Beneficiary must be a registered user');
      }
    }

    if (dto.beneficiaries && dto.beneficiaries.length > 2) {
      throw new BadRequestException('beneficiaries array cannot exceed 2 items');
    }
    if (dto.methods && dto.methods.length > 3) {
      throw new BadRequestException('methods array cannot exceed 3 items');
    }
    if (dto.helpNeeded && dto.helpNeeded.length > 3) {
      throw new BadRequestException('helpNeeded array cannot exceed 3 items');
    }

    let isPinned = false;
    if (dto.isPinned === true) {
      const isAdmin = await this.communityService.isUserAdmin(dto.communityId, userId);
      if (!isAdmin) {
        throw new ForbiddenException('Only community administrators can pin posts');
      }
      isPinned = true;
    }

    let postCostBreakdown: PostCostBreakdown | null = null;
    if (processPostCost) {
      if (!this.connection.db) {
        throw new Error('Database connection not available');
      }
      postCostBreakdown = await this.resolvePostCostBreakdown(
        userId,
        dto,
        community,
        postingAsCommunity,
      );
    }

    const publication = Publication.create(
      UserId.fromString(String(authorId)),
      CommunityId.fromString(dto.communityId),
      dto.content,
      dto.type,
      {
        beneficiaryId: dto.beneficiaryId
          ? UserId.fromString(dto.beneficiaryId)
          : undefined,
        hashtags: dto.hashtags || [],
        categories: dto.categories || [],
        valueTags: dto.valueTags || [],
        images: dto.images,
        videoUrl: dto.videoUrl,
        postType: dto.postType,
        isProject: dto.isProject,
        title: dto.title,
        description: dto.description,
        impactArea: dto.impactArea,
        beneficiaries: dto.beneficiaries,
        methods: dto.methods,
        stage: dto.stage,
        helpNeeded: dto.helpNeeded,
        sourceEntityId: dto.sourceEntityId,
        sourceEntityType: dto.sourceEntityType,
        ...(postingAsCommunity
          ? {
              authorKind: 'community' as const,
              authoredCommunityId: dto.sourceEntityId,
              publishedByUserId: userId,
            }
          : {}),
      },
    );

    const publicationId = publication.getId.getValue();
    const currency = community.settings?.currencyNames || {
      singular: 'merit',
      plural: 'merits',
      genitive: 'merits',
    };

    if (processPostCost && postCostBreakdown) {
      await this.applyPostCost(
        userId,
        publicationId,
        dto.communityId,
        postCostBreakdown,
        currency,
      );
    }

    const publicationSnapshot = publication.toSnapshot();
    const createdAt = new Date();
    const ttlExpiresAt =
      dto.ttlDays != null && dto.ttlDays > 0
        ? new Date(createdAt.getTime() + dto.ttlDays * 24 * 60 * 60 * 1000)
        : dto.ttlExpiresAt ?? null;

    await this.publicationPersistence.insertPublication({
      ...publicationSnapshot,
      postType: dto.postType || 'basic',
      isProject: dto.isProject || false,
      title: dto.title,
      description: dto.description,
      categories: dto.categories || [],
      investingEnabled: dto.investingEnabled ?? false,
      investorSharePercent: dto.investorSharePercent,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      ttlDays: dto.ttlDays ?? null,
      ttlExpiresAt,
      stopLoss: dto.stopLoss ?? 0,
      noAuthorWalletSpend: dto.noAuthorWalletSpend ?? false,
      isPinned,
      sourceEntityId: dto.sourceEntityId,
      sourceEntityType: dto.sourceEntityType,
      valueTags: dto.valueTags ?? [],
      ...(dto.postType === 'event'
        ? {
            eventStartDate: dto.eventStartDate,
            eventEndDate: dto.eventEndDate,
            eventTime: dto.eventTime,
            eventLocation: dto.eventLocation,
            eventParticipants: dto.eventParticipants ?? [],
            eventAttendees: [],
          }
        : {}),
    });

    await this.eventBus.publish(
      new PublicationCreatedEvent(publicationId, userId, dto.communityId),
    );

    this.logger.log(`Publication created successfully: ${publicationId}`);
    return publication;
  }
}

export function createCreatePublicationUseCase(deps: {
  publicationPersistence: PublicationPersistencePort;
  connection: Connection;
  eventBus: EventBus;
  permissionService: PermissionService;
  communityService: CommunityService;
  userCommunityRoleService: UserCommunityRoleService;
  userService: UserService;
  communityWalletService: CommunityWalletService;
  walletService: WalletService;
  walletContextResolverService: WalletContextResolverService;
}): CreatePublicationUseCase {
  return new CreatePublicationUseCase(
    deps.publicationPersistence,
    deps.connection,
    deps.eventBus,
    deps.permissionService,
    deps.communityService,
    deps.userCommunityRoleService,
    deps.userService,
    deps.communityWalletService,
    deps.walletService,
    deps.walletContextResolverService,
  );
}
