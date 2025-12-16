import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { CommunityService } from '../../domain/services/community.service';
import { QuotaUsageService } from '../../domain/services/quota-usage.service';
import { WalletService } from '../../domain/services/wallet.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { PermissionsHelperService } from '../common/services/permissions-helper.service';
import { EntityMappers } from '../common/mappers/entity-mappers';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { PermissionGuard } from '../../permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreatePublicationDto,
  CreatePublicationDtoSchema,
  UpdatePublicationDtoSchema,
  VoteDirectionDtoSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { ValidationError } from '../../common/exceptions/api.exceptions';

@Controller('api/v1/publications')
@UseGuards(UserGuard, PermissionGuard)
export class PublicationsController {
  private readonly logger = new Logger(PublicationsController.name);

  constructor(
    private publicationService: PublicationService,
    private userService: UserService,
    private communityService: CommunityService,
    private quotaUsageService: QuotaUsageService,
    private walletService: WalletService,
    private userEnrichmentService: UserEnrichmentService,
    private communityEnrichmentService: CommunityEnrichmentService,
    private permissionsHelperService: PermissionsHelperService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Post()
  @ZodValidation(CreatePublicationDtoSchema)
  @RequirePermission('create', 'publication')
  async createPublication(
    @User() user: AuthenticatedUser,
    @Body() dto: CreatePublicationDto,
  ) {
    // Get community to check payment requirements
    const community = await this.communityService.getCommunity(dto.communityId);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Get post cost from community settings (default to 1 if not set)
    const postCost = community.settings?.postCost ?? 1;
    
    // Extract payment amounts
    const quotaAmount = dto.quotaAmount ?? 0;
    const walletAmount = dto.walletAmount ?? 0;
    
    // Default to postCost quota if neither is specified (backward compatibility)
    const effectiveQuotaAmount = quotaAmount === 0 && walletAmount === 0 ? postCost : quotaAmount;
    const effectiveWalletAmount = walletAmount;
    
    // Validate payment (skip for future-vision communities and if cost is 0)
    if (community.typeTag !== 'future-vision' && postCost > 0) {
      // Validate that at least one payment method is provided
      if (effectiveQuotaAmount === 0 && effectiveWalletAmount === 0) {
        throw new ValidationError(
          `You must pay with either quota or wallet merits to create a post. The cost is ${postCost}. At least one of quotaAmount or walletAmount must be at least ${postCost}.`,
        );
      }

      // Check quota if using quota
      if (effectiveQuotaAmount > 0) {
        const remainingQuota = await this.getRemainingQuota(
          user.id,
          dto.communityId,
          community,
        );

        if (remainingQuota < effectiveQuotaAmount) {
          throw new ValidationError(
            `Insufficient quota. Available: ${remainingQuota}, Requested: ${effectiveQuotaAmount}`,
          );
        }
      }

      // Check wallet balance if using wallet
      if (effectiveWalletAmount > 0) {
        const wallet = await this.walletService.getWallet(user.id, dto.communityId);
        const walletBalance = wallet ? wallet.getBalance() : 0;

        if (walletBalance < effectiveWalletAmount) {
          throw new ValidationError(
            `Insufficient wallet balance. Available: ${walletBalance}, Requested: ${effectiveWalletAmount}`,
          );
        }
      }
    }

    // Create publication
    const publication = await this.publicationService.createPublication(
      user.id,
      dto,
    );

    // Extract IDs for enrichment
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();
    const publicationId = publication.getId.getValue();

    // Process payment after successful creation (skip for future-vision communities)
    if (community.typeTag !== 'future-vision') {
      // Record quota usage if quota was used
      if (effectiveQuotaAmount > 0) {
        try {
          await this.quotaUsageService.consumeQuota(
            user.id,
            communityId,
            effectiveQuotaAmount,
            'publication_creation',
            publicationId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to consume quota for publication ${publicationId}:`,
            error,
          );
          // Don't fail the request if quota consumption fails - publication is already created
          // This is a best-effort quota tracking
        }
      }

      // Deduct from wallet if wallet was used
      if (effectiveWalletAmount > 0) {
        try {
          const currency = community.settings?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          };

          await this.walletService.addTransaction(
            user.id,
            communityId,
            'debit',
            effectiveWalletAmount,
            'personal',
            'publication_creation',
            publicationId,
            currency,
            `Payment for creating publication`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to deduct wallet balance for publication ${publicationId}:`,
            error,
          );
          // Don't fail the request if wallet deduction fails - publication is already created
          // This is a best-effort payment tracking
        }
      }
    }

    // Batch fetch users and communities
    const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(userIds),
      this.communityEnrichmentService.batchFetchCommunities([communityId]),
    ]);

    // Map domain entity to API format
    const mappedPublication = EntityMappers.mapPublicationToApi(
      publication,
      usersMap,
      communitiesMap,
    );

    return ApiResponseHelper.successResponse(mappedPublication);
  }

  /**
   * Calculate remaining quota for a user in a community
   */
  private async getRemainingQuota(
    userId: string,
    communityId: string,
    community: any,
  ): Promise<number> {
    // Future Vision has no quota - wallet voting only
    if (community?.typeTag === 'future-vision') {
      return 0;
    }

    if (
      !community.settings?.dailyEmission ||
      typeof community.settings.dailyEmission !== 'number'
    ) {
      return 0;
    }

    const dailyQuota = community.settings.dailyEmission;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt
      ? new Date(community.lastQuotaResetAt)
      : today;

    // Aggregate quota used from votes, poll casts, and quota usage
    const [votesUsed, pollCastsUsed, quotaUsageUsed] = await Promise.all([
      this.connection.db
        .collection('votes')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
      this.connection.db
        .collection('poll_casts')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
      this.connection.db
        .collection('quota_usage')
        .aggregate([
          {
            $match: {
              userId,
              communityId,
              createdAt: { $gte: quotaStartTime },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amountQuota' },
            },
          },
        ])
        .toArray(),
    ]);

    const votesTotal = votesUsed.length > 0 && votesUsed[0] ? (votesUsed[0].total as number) : 0;
    const pollCastsTotal = pollCastsUsed.length > 0 && pollCastsUsed[0] ? (pollCastsUsed[0].total as number) : 0;
    const quotaUsageTotal = quotaUsageUsed.length > 0 && quotaUsageUsed[0] ? (quotaUsageUsed[0].total as number) : 0;
    const used = votesTotal + pollCastsTotal + quotaUsageTotal;

    return Math.max(0, dailyQuota - used);
  }

  @Get(':id')
  async getPublication(@Param('id') id: string, @User() user: AuthenticatedUser | null) {
    const publication = await this.publicationService.getPublication(id);

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Extract IDs for enrichment
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();

    // Batch fetch users and communities
    const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
    const [usersMap, communitiesMap, permissions] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(userIds),
      this.communityEnrichmentService.batchFetchCommunities([communityId]),
      this.permissionsHelperService.calculatePublicationPermissions(user?.id, id),
    ]);

    const mappedPublication = EntityMappers.mapPublicationToApi(
      publication,
      usersMap,
      communitiesMap,
    );
    
    // Add permissions to response
    mappedPublication.permissions = permissions;
    
    return ApiResponseHelper.successResponse(mappedPublication);
  }

  @Get()
  async getPublications(
    @Query('communityId') communityId?: string,
    @Query('authorId') authorId?: string,
    @Query('hashtag') hashtag?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @User() user: AuthenticatedUser | null,
  ) {
    // Support both pagination formats: limit/skip and page/pageSize
    let parsedLimit = 20;
    let parsedSkip = 0;

    if (pageSize) {
      parsedLimit = parseInt(pageSize, 10);
    } else if (limit) {
      parsedLimit = parseInt(limit, 10);
    }

    if (page && pageSize) {
      parsedSkip = (parseInt(page, 10) - 1) * parsedLimit;
    } else if (skip) {
      parsedSkip = parseInt(skip, 10);
    }

    let publications: any[];
    let mappedPublications: any[];

    if (communityId) {
      publications = await this.publicationService.getPublicationsByCommunity(
        communityId,
        parsedLimit,
        parsedSkip,
      );

      // Extract unique user IDs (authors and beneficiaries) and community IDs
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach((pub) => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        this.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        this.communityEnrichmentService.batchFetchCommunities(
          Array.from(communityIds),
        ),
      ]);

      // Convert domain entities to DTOs with enriched user metadata
      mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );
    } else if (authorId) {
      publications =
        await this.publicationService.getPublicationsByAuthor(
          authorId,
          parsedLimit,
          parsedSkip,
        );

      // Extract unique user IDs (authors and beneficiaries) and community IDs
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach((pub) => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        this.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        this.communityEnrichmentService.batchFetchCommunities(
          Array.from(communityIds),
        ),
      ]);

      // Convert domain entities to DTOs with enriched user metadata
      mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );
    } else if (hashtag) {
      publications = await this.publicationService.getPublicationsByHashtag(
        hashtag,
        parsedLimit,
        parsedSkip,
      );

      // Extract unique user IDs (authors and beneficiaries) and community IDs
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach((pub) => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        this.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        this.communityEnrichmentService.batchFetchCommunities(
          Array.from(communityIds),
        ),
      ]);

      // Convert domain entities to DTOs with enriched user metadata
      mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );
    } else {
      publications = await this.publicationService.getTopPublications(
        parsedLimit,
        parsedSkip,
      );

      // Extract unique user IDs (authors and beneficiaries) and community IDs
      const userIds = new Set<string>();
      const communityIds = new Set<string>();
      publications.forEach((pub) => {
        userIds.add(pub.getAuthorId.getValue());
        if (pub.getBeneficiaryId) {
          userIds.add(pub.getBeneficiaryId.getValue());
        }
        communityIds.add(pub.getCommunityId.getValue());
      });

      // Batch fetch all users and communities
      const [usersMap, communitiesMap] = await Promise.all([
        this.userEnrichmentService.batchFetchUsers(Array.from(userIds)),
        this.communityEnrichmentService.batchFetchCommunities(
          Array.from(communityIds),
        ),
      ]);

      // Convert domain entities to DTOs with enriched user metadata
      mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );
    }

    // Batch calculate permissions for all publications
    const publicationIds = mappedPublications.map((pub) => pub.id);
    const permissionsMap = await this.permissionsHelperService.batchCalculatePublicationPermissions(
      user?.id,
      publicationIds,
    );

    // Add permissions to each publication
    mappedPublications.forEach((pub) => {
      pub.permissions = permissionsMap.get(pub.id);
    });

    return ApiResponseHelper.successResponse(mappedPublications);
  }

  @Put(':id')
  @ZodValidation(UpdatePublicationDtoSchema)
  @RequirePermission('edit', 'publication')
  async updatePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    const publication = await this.publicationService.updatePublication(id, user.id, updates);

    // Extract IDs for enrichment
    const authorId = publication.getAuthorId.getValue();
    const beneficiaryId = publication.getBeneficiaryId?.getValue();
    const communityId = publication.getCommunityId.getValue();

    // Batch fetch users and communities
    const userIds = [authorId, ...(beneficiaryId ? [beneficiaryId] : [])];
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(userIds),
      this.communityEnrichmentService.batchFetchCommunities([communityId]),
    ]);

    // Map domain entity to API format
    const mappedPublication = EntityMappers.mapPublicationToApi(
      publication,
      usersMap,
      communitiesMap,
    );

    return ApiResponseHelper.successResponse(mappedPublication);
  }

  @Delete(':id')
  @RequirePermission('delete', 'publication')
  async deletePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.publicationService.deletePublication(id, user.id);
    return { success: true };
  }

  @Post(':id/vote')
  @ZodValidation(VoteDirectionDtoSchema)
  @RequirePermission('vote', 'publication')
  async voteOnPublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.publicationService.voteOnPublication(
      id,
      user.id,
      dto.amount,
      dto.direction,
    );
  }

  @Post('fake-data')
  async generateFakeData(
    @User() user: AuthenticatedUser,
    @Body() body: { type: 'user' | 'beneficiary'; communityId?: string },
  ) {
    // Check if fake data mode is enabled
    if (process.env.FAKE_DATA_MODE !== 'true') {
      throw new ForbiddenException('Fake data mode is not enabled');
    }

    this.logger.log(
      `Generating fake data: type=${body.type}, userId=${user.id}`,
    );

    // Get or use the specified community, or create/get a test community
    let communityId: string;
    let community: any;

    if (body.communityId) {
      // Use the specified community
      communityId = body.communityId;
      community = await this.communityService.getCommunity(communityId);
      if (!community) {
        throw new NotFoundException(`Community ${communityId} not found`);
      }
      this.logger.log(`Using specified community: ${communityId}`);
    } else {
      // Get or create a test community
      let communities = await this.communityService.getAllCommunities(1, 0);
      if (communities.length === 0) {
        // Create a test community if none exists
        const testCommunity = await this.communityService.createCommunity({
          name: 'Test Community',
          description: 'Test community for fake data',
        });
        communityId = testCommunity.id;
        community = testCommunity;
        this.logger.log(`Created test community: ${communityId}`);
      } else {
        communityId = communities[0].id;
        community = await this.communityService.getCommunity(communityId);
      }
    }

    // Ensure the community has the 'test' hashtag for fake data generation
    const hashtags = community?.hashtags || [];
    if (!hashtags.includes('test')) {
      const updatedHashtags = [...hashtags, 'test'];
      await this.communityService.updateCommunity(communityId, {
        hashtags: updatedHashtags,
      });
      this.logger.log(`Added 'test' hashtag to community ${communityId}`);
    }

    const createdPublications: any[] = [];

    if (body.type === 'user') {
      // Create 1-2 user posts (by the authenticated fake user)
      const contents = [
        'Test post #1 from fake user',
        'Test post #2 from fake user',
      ];

      for (let i = 0; i < Math.min(2, contents.length); i++) {
        const publication = await this.publicationService.createPublication(
          user.id,
          {
            communityId,
            content: contents[i],
            type: 'text',
            hashtags: ['#test'],
          },
        );
        createdPublications.push(publication);
      }
    } else if (body.type === 'beneficiary') {
      // Get a random user (excluding fake users)
      const allUsers = await this.userService.getAllUsers(100, 0);
      const otherUsers = allUsers.filter(
        (u) => !u.authId?.startsWith('fake_user_') && u.id !== user.id,
      );

      let beneficiaryId: string;

      if (otherUsers.length === 0) {
        // Create a test beneficiary user if none exists
        const testBeneficiary = await this.userService.createOrUpdateUser({
          authProvider: 'fake',
          authId: `fake_beneficiary_${Date.now()}`,
          username: 'fakebeneficiary',
          firstName: 'Fake',
          lastName: 'Beneficiary',
          displayName: 'Fake Beneficiary User',
        });
        beneficiaryId = testBeneficiary.id;
        this.logger.log(`Created test beneficiary user: ${beneficiaryId}`);
      } else {
        // Pick a random user
        const randomIndex = Math.floor(Math.random() * otherUsers.length);
        beneficiaryId = otherUsers[randomIndex].id;
        this.logger.log(`Using random beneficiary: ${beneficiaryId}`);
      }

      // Create 1-2 posts with random beneficiary
      const contents = [
        'Test post #1 with beneficiary',
        'Test post #2 with beneficiary',
      ];

      for (let i = 0; i < Math.min(2, contents.length); i++) {
        try {
          const publication = await this.publicationService.createPublication(
            user.id,
            {
              communityId,
              content: contents[i],
              type: 'text',
              hashtags: ['#test'],
              beneficiaryId,
            },
          );
          createdPublications.push(publication);
        } catch (error) {
          this.logger.error(`Failed to create publication ${i + 1}:`, error);
        }
      }
    }

    this.logger.log(`Created ${createdPublications.length} fake publications`);

    return {
      success: true,
      data: {
        publications: createdPublications,
        count: createdPublications.length,
      },
    };
  }
}
