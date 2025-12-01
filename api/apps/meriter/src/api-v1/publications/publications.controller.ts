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
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PublicationService } from '../../domain/services/publication.service';
import { UserService } from '../../domain/services/user.service';
import { CommunityService } from '../../domain/services/community.service';
import { PermissionService } from '../../domain/services/permission.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../common/services/community-enrichment.service';
import { EntityMappers } from '../common/mappers/entity-mappers';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreatePublicationDto,
  CreatePublicationDtoSchema,
  UpdatePublicationDtoSchema,
  VoteDirectionDtoSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

@ApiTags('Publications')
@Controller('api/v1/publications')
@UseGuards(UserGuard)
@ApiCookieAuth('jwt')
@ApiBearerAuth()
export class PublicationsController {
  private readonly logger = new Logger(PublicationsController.name);

  constructor(
    private publicationService: PublicationService,
    private userService: UserService,
    private communityService: CommunityService,
    private permissionService: PermissionService,
    private userEnrichmentService: UserEnrichmentService,
    private communityEnrichmentService: CommunityEnrichmentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new publication' })
  @ApiResponse({ status: 201, description: 'Publication created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ZodValidation(CreatePublicationDtoSchema)
  async createPublication(
    @User() user: AuthenticatedUser,
    @Body() dto: CreatePublicationDto,
  ) {
    // Check permissions using PermissionService
    const canCreate = await this.permissionService.canCreatePublication(
      user.id,
      dto.communityId,
    );

    if (!canCreate) {
      throw new ForbiddenException(
        'You do not have permission to create publications in this community',
      );
    }

    const publication = await this.publicationService.createPublication(
      user.id,
      dto,
    );

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

  @Get(':id')
  @ApiOperation({ summary: 'Get a publication by ID' })
  @ApiParam({ name: 'id', description: 'Publication ID' })
  @ApiResponse({ status: 200, description: 'Publication found' })
  @ApiResponse({ status: 404, description: 'Publication not found' })
  async getPublication(@Param('id') id: string) {
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
    const [usersMap, communitiesMap] = await Promise.all([
      this.userEnrichmentService.batchFetchUsers(userIds),
      this.communityEnrichmentService.batchFetchCommunities([communityId]),
    ]);

    const mappedPublication = EntityMappers.mapPublicationToApi(
      publication,
      usersMap,
      communitiesMap,
    );
    return ApiResponseHelper.successResponse(mappedPublication);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of publications' })
  @ApiQuery({ name: 'communityId', required: false, description: 'Filter by community ID' })
  @ApiQuery({ name: 'authorId', required: false, description: 'Filter by author ID' })
  @ApiQuery({ name: 'hashtag', required: false, description: 'Filter by hashtag' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of items per page' })
  @ApiQuery({ name: 'skip', required: false, description: 'Number of items to skip' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'List of publications' })
  async getPublications(
    @Query('communityId') communityId?: string,
    @Query('authorId') authorId?: string,
    @Query('hashtag') hashtag?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
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

    if (communityId) {
      return this.publicationService.getPublicationsByCommunity(
        communityId,
        parsedLimit,
        parsedSkip,
      );
    }

    if (authorId) {
      const publications =
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
      const mappedPublications = publications.map((publication) =>
        EntityMappers.mapPublicationToApi(
          publication,
          usersMap,
          communitiesMap,
        ),
      );

      return ApiResponseHelper.successResponse(mappedPublications);
    }

    if (hashtag) {
      return this.publicationService.getPublicationsByHashtag(
        hashtag,
        parsedLimit,
        parsedSkip,
      );
    }

    return this.publicationService.getTopPublications(parsedLimit, parsedSkip);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a publication' })
  @ApiParam({ name: 'id', description: 'Publication ID' })
  @ApiResponse({ status: 200, description: 'Publication updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Publication not found' })
  @ZodValidation(UpdatePublicationDtoSchema)
  async updatePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updates: any,
  ) {
    // Check permissions using PermissionService
    const canEdit = await this.permissionService.canEditPublication(
      user.id,
      id,
    );
    if (!canEdit) {
      throw new ForbiddenException(
        'You do not have permission to edit this publication',
      );
    }

    return this.publicationService.updatePublication(id, user.id, updates);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a publication' })
  @ApiParam({ name: 'id', description: 'Publication ID' })
  @ApiResponse({ status: 200, description: 'Publication deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async deletePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    // Check permissions using PermissionService
    const canDelete = await this.permissionService.canDeletePublication(
      user.id,
      id,
    );
    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this publication',
      );
    }

    await this.publicationService.deletePublication(id, user.id);
    return { success: true };
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote on a publication' })
  @ApiParam({ name: 'id', description: 'Publication ID' })
  @ApiResponse({ status: 200, description: 'Vote recorded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ZodValidation(VoteDirectionDtoSchema)
  async voteOnPublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    // Check permissions using PermissionService
    const canVote = await this.permissionService.canVote(user.id, id);
    if (!canVote) {
      throw new ForbiddenException(
        'You do not have permission to vote on this publication',
      );
    }

    return this.publicationService.voteOnPublication(
      id,
      user.id,
      dto.amount,
      dto.direction,
    );
  }

  @Post('fake-data')
  @ApiOperation({ summary: 'Generate fake data for testing' })
  @ApiResponse({ status: 200, description: 'Fake data generated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - fake data mode not enabled' })
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
          adminIds: [],
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
