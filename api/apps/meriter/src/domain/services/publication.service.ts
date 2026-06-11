import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { Publication } from '../aggregates/publication/publication.entity';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
  type PublicationPersistenceSession,
} from '../ports/publication.persistence.port';
import { PublicationId } from '../value-objects';
import { PublicationCreatedEvent, PublicationUpdatedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { PublicationDocument as IPublicationDocument } from '../../common/interfaces/publication-document.interface';
import { PermissionService } from './permission.service';
import { CommunityService } from './community.service';
import { CommunityWalletService } from './community-wallet.service';
import {
  CREATE_PUBLICATION_PORT,
  type CreatePublicationExecuteOptions,
  type CreatePublicationPort,
} from '../ports/create-publication.port';
import {
  PUBLISH_PROJECT_TO_BIRZHA_PORT,
  PUBLISH_COMMUNITY_TO_BIRZHA_PORT,
  type PublishCommunityToBirzhaPort,
  type PublishProjectToBirzhaPort,
  type PublishSourceEntityToBirzhaParams,
} from '../ports/publish-to-birzha.port';

export interface CreatePublicationDto {
  communityId: string;
  title?: string;
  description?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  postType?: 'basic' | 'poll' | 'project' | 'ticket' | 'discussion' | 'event';
  isProject?: boolean;
  hashtags?: string[];
  categories?: string[]; // Array of category IDs
  valueTags?: string[];
  images?: string[]; // Array of image URLs for multi-image support
  videoUrl?: string;
  beneficiaryId?: string;
  /** When set (and caller verified as lead), post is attributed to this community. */
  sourceEntityId?: string;
  sourceEntityType?: 'project' | 'community';
  quotaAmount?: number;
  walletAmount?: number;
  /** When true, use case deducts postCost (inv-01). Interim: router still charges unless set. */
  processPostCost?: boolean;
  postCostFunding?: 'source_community_wallet' | 'caller_global_wallet';
  // Merged from dev
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
  investingEnabled?: boolean;
  investorSharePercent?: number;
  ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
  ttlExpiresAt?: Date | null;
  stopLoss?: number;
  noAuthorWalletSpend?: boolean;
  isPinned?: boolean;
  eventStartDate?: Date;
  eventEndDate?: Date;
  eventTime?: string;
  eventLocation?: string;
  eventAttendees?: string[];
  eventParticipants?: Array<{
    userId: string;
    attendance?: 'checked_in' | 'no_show' | null;
    attendanceUpdatedAt?: Date | null;
    attendanceUpdatedByUserId?: string | null;
  }>;
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    private eventBus: EventBus,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
    private communityWalletService: CommunityWalletService,
    @Inject(CREATE_PUBLICATION_PORT)
    private readonly createPublicationUseCase: CreatePublicationPort,
    @Inject(PUBLISH_PROJECT_TO_BIRZHA_PORT)
    private readonly publishProjectToBirzhaUseCase: PublishProjectToBirzhaPort,
    @Inject(PUBLISH_COMMUNITY_TO_BIRZHA_PORT)
    private readonly publishCommunityToBirzhaUseCase: PublishCommunityToBirzhaPort,
  ) {}

  async createPublication(
    userId: string,
    dto: CreatePublicationDto,
    options?: CreatePublicationExecuteOptions,
  ): Promise<Publication> {
    return this.createPublicationUseCase.execute(userId, dto, {
      checkPermissions: options?.checkPermissions ?? false,
      processPostCost: options?.processPostCost ?? dto.processPostCost ?? false,
    });
  }

  /**
   * Backdates publication timestamps for platform baseline seed so posts appear spread over time.
   * Recalculates ttlExpiresAt from ttlDays when set (investing posts).
   */
  async setPublicationTimestampsForSeed(
    publicationId: string,
    createdAt: Date,
  ): Promise<void> {
    const doc = await this.publicationPersistence.findById(publicationId);
    if (!doc) return;
    const ttlDays = doc.ttlDays;
    const ttlExpiresAt =
      ttlDays != null && ttlDays > 0
        ? new Date(createdAt.getTime() + ttlDays * 24 * 60 * 60 * 1000)
        : doc.ttlExpiresAt ?? null;
    await this.publicationPersistence.setPublicationTimestampsForSeed(
      publicationId,
      createdAt,
      ttlExpiresAt,
    );
  }

  /**
   * Birzha (МД) post from a project or eligible local community.
   * postCost from CommunityWallet(sourceEntityId); rights validated in use cases (inv-07/inv-08).
   */
  async publishSourceEntityToBirzha(
    params: PublishSourceEntityToBirzhaParams,
  ): Promise<{ id: string }> {
    if (params.sourceEntityType === 'project') {
      return this.publishProjectToBirzhaUseCase.execute({
        callerId: params.callerId,
        projectId: params.sourceEntityId,
        content: params.content,
        type: params.type,
        title: params.title,
        description: params.description,
        images: params.images,
        valueTags: params.valueTags,
        hashtags: params.hashtags,
        beneficiaryId: params.beneficiaryId,
        postCostFunding: params.postCostFunding,
        investingEnabled: params.investingEnabled,
        investorSharePercent: params.investorSharePercent,
        ttlDays: params.ttlDays,
        stopLoss: params.stopLoss,
        noAuthorWalletSpend: params.noAuthorWalletSpend,
      });
    }

    return this.publishCommunityToBirzhaUseCase.execute({
      callerId: params.callerId,
      communityId: params.sourceEntityId,
      content: params.content,
      type: params.type,
      title: params.title,
      description: params.description,
      images: params.images,
      valueTags: params.valueTags,
      hashtags: params.hashtags,
      beneficiaryId: params.beneficiaryId,
      postCostFunding: params.postCostFunding,
      investingEnabled: params.investingEnabled,
      investorSharePercent: params.investorSharePercent,
      ttlDays: params.ttlDays,
      stopLoss: params.stopLoss,
      noAuthorWalletSpend: params.noAuthorWalletSpend,
    });
  }

  /** Thin wrapper; delegates to {@link publishSourceEntityToBirzha}. */
  async createFromProjectToBirzha(params: {
    projectId: string;
    authorId: string;
    content: string;
    type: 'text' | 'image' | 'video';
    title: string;
    description?: string;
    images?: string[];
    investorSharePercent: number;
  }): Promise<{ id: string }> {
    return this.publishSourceEntityToBirzha({
      sourceEntityType: 'project',
      sourceEntityId: params.projectId,
      callerId: params.authorId,
      title: params.title,
      content: params.content,
      type: params.type,
      description: params.description,
      images: params.images,
      investorSharePercent: params.investorSharePercent,
    });
  }

  /** Post on МД with a Birzha source entity (project or community), managed by source admins. */
  async isBirzhaSourceManagedPost(
    doc: IPublicationDocument | null,
  ): Promise<boolean> {
    if (!doc?.sourceEntityId) {
      return false;
    }
    if (doc.sourceEntityType !== 'project' && doc.sourceEntityType !== 'community') {
      return false;
    }
    const comm = await this.communityService.getCommunity(doc.communityId);
    return comm?.typeTag === 'marathon-of-good';
  }

  /**
   * Top up Birzha post rating using the source entity CommunityWallet (not caller's personal wallet).
   */
  async topUpBirzhaPublicationFromSourceWallet(
    userId: string,
    publicationId: string,
    amount: number,
  ): Promise<{ amount: number }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }
    const doc = await this.publicationPersistence.findById(publicationId);
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }
    const p = doc as IPublicationDocument;
    if ((p.status ?? 'active') === 'closed') {
      throw new BadRequestException('This post is closed and cannot be modified');
    }
    if (!(await this.isBirzhaSourceManagedPost(p))) {
      throw new BadRequestException(
        'Source wallet top-up is only for Birzha posts from a project or community source',
      );
    }
    await this.permissionService.assertCanManageBirzhaSourcePost(userId, publicationId);
    const sourceEntityId = p.sourceEntityId as string;
    await this.communityWalletService.createWallet(sourceEntityId);
    await this.communityWalletService.deductBalance(
      sourceEntityId,
      amount,
      'publication_rating_topup',
    );
    await this.voteOnPublication(publicationId, userId, amount, 'up');
    return { amount };
  }

  /**
   * Create an OB (Future Vision) post when a community is created with futureVisionText.
   * System action: postCost=0, no fee deduction.
   */
  async createFutureVisionPost(params: {
    futureVisionCommunityId: string;
    authorId: string;
    content: string;
    sourceEntityId: string;
  }): Promise<{ id: string }> {
    const id = PublicationId.generate().getValue();
    const now = new Date();

    await this.publicationPersistence.insertPublication({
      id,
      communityId: params.futureVisionCommunityId,
      authorId: params.authorId,
      sourceEntityId: params.sourceEntityId,
      sourceEntityType: 'community',
      content: params.content,
      type: 'text',
      hashtags: [],
      categories: [],
      images: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      investingEnabled: false,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      status: 'active',
      postType: 'basic',
      isProject: false,
      createdAt: now,
      updatedAt: now,
    });

    await this.eventBus.publish(
      new PublicationCreatedEvent(
        id,
        params.authorId,
        params.futureVisionCommunityId,
      ),
    );

    this.logger.log(
      `OB post created for community ${params.sourceEntityId}: ${id}`,
    );
    return { id };
  }

  /**
   * Update OB post content when community futureVisionText is updated.
   * Bypasses edit window; preserves rating, votes, comments.
   */
  async updateFutureVisionPostContent(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
    content: string,
  ): Promise<boolean> {
    const updated = await this.publicationPersistence.updateFutureVisionPostContent(
      futureVisionCommunityId,
      sourceCommunityId,
      content,
    );
    if (updated) {
      this.logger.log(
        `OB post content updated for community ${sourceCommunityId}`,
      );
    }
    return updated;
  }

  /**
   * Find OB publication id by source community (if any).
   */
  async findFutureVisionPostId(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
  ): Promise<string | null> {
    return this.publicationPersistence.findFutureVisionPostId(
      futureVisionCommunityId,
      sourceCommunityId,
    );
  }

  /**
   * List OB posts in future-vision community, sorted by metrics.score descending.
   * Used for getFutureVisions feed.
   */
  async findObPostsSortedByScore(
    futureVisionCommunityId: string,
  ): Promise<{ id: string; sourceEntityId: string; metrics: { score: number } }[]> {
    const docs = await this.publicationPersistence.findObPosts(
      futureVisionCommunityId,
      { sort: 'score' },
    );
    return docs.map((d) => ({
      id: d.id,
      sourceEntityId: d.sourceEntityId,
      metrics: { score: d.metrics.score },
    }));
  }

  /**
   * List OB posts in future-vision community with configurable sorting.
   * Used for getFutureVisions feed.
   */
  async findObPosts(
    futureVisionCommunityId: string,
    params: { sort: 'score' | 'createdAt' },
  ): Promise<{ id: string; sourceEntityId: string; metrics: { score: number }; createdAt: Date }[]> {
    const docs = await this.publicationPersistence.findObPosts(
      futureVisionCommunityId,
      params,
    );
    return docs.map((d) => ({
      id: d.id,
      sourceEntityId: d.sourceEntityId,
      metrics: { score: d.metrics.score },
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date(0),
    }));
  }

  async getPublication(id: string): Promise<Publication | null> {
    // Direct Mongoose query
    const doc = await this.publicationPersistence.findById(id);
    return doc ? Publication.fromSnapshot(doc as IPublicationDocument) : null;
  }

  /** Hub «Посты» tab: non-project publications with body text in a community feed. */
  async countHubFeedPublicationsByCommunity(communityId: string): Promise<number> {
    return this.publicationPersistence.countHubFeedPublicationsByCommunity(communityId);
  }

  /** Cooperative project hub «Посты» tab: tickets + discussions. */
  async countProjectHubPosts(projectId: string): Promise<number> {
    return this.publicationPersistence.countProjectHubPosts(projectId);
  }

  /** Count active Birzha posts for a source entity (same filter as {@link getBirzhaPostsBySourceEntity}). */
  async countBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
  ): Promise<number> {
    return this.publicationPersistence.countBirzhaPostsBySourceEntity(
      birzhaCommunityId,
      sourceEntityType,
      sourceEntityId,
    );
  }

  /** Active posts on Birzha (МД) for a given source entity. */
  async getBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
    limit: number,
    skip: number,
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findBirzhaPostsBySourceEntity(
      birzhaCommunityId,
      sourceEntityType,
      sourceEntityId,
      limit,
      skip,
    );
    return docs.map((d) =>
      Publication.fromSnapshot(d as IPublicationDocument),
    );
  }

  /** Get raw publication document (for investment checks, etc.) */
  async getPublicationDocument(
    id: string,
  ): Promise<IPublicationDocument | null> {
    return (await this.publicationPersistence.findById(id)) as IPublicationDocument | null;
  }

  async getPublicationsByCommunity(
    communityId: string,
    limit: number = 20,
    skip: number = 0,
    sortBy?: 'createdAt' | 'score',
    hashtag?: string,
    filters?: {
      impactArea?: string;
      stage?: string;
      beneficiaries?: string[];
      methods?: string[];
      helpNeeded?: string[];
      categories?: string[]; // Array of category IDs
      valueTags?: string[];
    },
    search?: string,
    hubPostsFeedOnly = false,
    pinOptions?: { pinnedOnly?: boolean; excludePinned?: boolean },
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findPublicationsByCommunity({
      communityId,
      limit,
      skip,
      sortBy,
      hashtag,
      filters,
      search,
      hubPostsFeedOnly,
      pinnedOnly: pinOptions?.pinnedOnly,
      excludePinned: pinOptions?.excludePinned,
    });
    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  async getTopPublications(
    limit: number = 20,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findTopPublications(limit, skip);
    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  async voteOnPublication(
    publicationId: string,
    userId: string,
    amount: number,
    direction: 'up' | 'down',
  ): Promise<Publication> {
    const id = PublicationId.fromString(publicationId);

    const doc = await this.publicationPersistence.findById(id.getValue());
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    const voteAmount = direction === 'up' ? amount : -amount;
    publication.vote(voteAmount);

    const snapshot = publication.toSnapshot();
    if (direction === 'up' && amount > 0) {
      snapshot.lastEarnedAt = new Date();
    }
    await this.publicationPersistence.updateWithVoteMetrics(
      publication.getId.getValue(),
      {
        snapshot,
        lifetimeCreditIncrement: voteAmount > 0 ? voteAmount : undefined,
      },
    );

    return publication;
  }

  async reduceScore(
    publicationId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<Publication> {
    const id = PublicationId.fromString(publicationId);

    const doc = await this.publicationPersistence.findById(
      id.getValue(),
      session as PublicationPersistenceSession | undefined,
    );
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);
    publication.reduceScore(amount);

    await this.publicationPersistence.updateSnapshot(
      publication.getId.getValue(),
      publication.toSnapshot(),
      session as PublicationPersistenceSession | undefined,
    );

    return publication;
  }

  async getPublicationsByAuthor(
    authorId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findPublicationsByAuthor(
      authorId,
      limit,
      skip,
    );
    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  /**
   * Count active publications by author excluding project posts (aligns with profile publications tab).
   */
  async countProfilePublicationsByAuthor(authorId: string): Promise<number> {
    return this.publicationPersistence.countProfilePublicationsByAuthor(authorId);
  }

  async getPublicationsByHashtag(
    hashtag: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findPublicationsByHashtag(
      hashtag,
      limit,
      skip,
    );
    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  /**
   * Get deleted publications by community (for leads only)
   */
  async getDeletedPublicationsByCommunity(
    communityId: string,
    limit: number = 20,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationPersistence.findDeletedPublicationsByCommunity(
      communityId,
      limit,
      skip,
    );
    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  /**
   * Get the effective beneficiary for a publication
   * Returns beneficiaryId if set, otherwise authorId
   */
  async getEffectiveBeneficiary(publicationId: string): Promise<string | null> {
    const publication = await this.getPublication(publicationId);
    if (!publication) {
      return null;
    }
    return publication.getEffectiveBeneficiary().getValue();
  }

  /**
   * Check if user can withdraw from a publication
   * User must be the effective beneficiary
   */
  async canUserWithdraw(
    publicationId: string,
    userId: string,
  ): Promise<boolean> {
    const effectiveBeneficiary =
      await this.getEffectiveBeneficiary(publicationId);
    if (!effectiveBeneficiary) {
      return false;
    }
    return effectiveBeneficiary === userId;
  }

  async updatePublication(
    publicationId: string,
    userId: string,
    updateData: Partial<CreatePublicationDto>,
  ): Promise<Publication> {
    // Explicitly reject attempts to change postType or isProject
    if ('postType' in updateData && updateData.postType !== undefined) {
      throw new BadRequestException('Cannot change post type when editing a publication');
    }
    if ('isProject' in updateData && updateData.isProject !== undefined) {
      throw new BadRequestException('Cannot change project status when editing a publication');
    }

    // Immutable: reject any change to investment contract
    if (updateData.investingEnabled !== undefined) {
      throw new BadRequestException(
        'Cannot change investment status after post creation',
      );
    }
    if (updateData.investorSharePercent !== undefined) {
      throw new BadRequestException(
        'Investment contract percentage is immutable',
      );
    }

    // Validate array lengths
    if (updateData.beneficiaries && updateData.beneficiaries.length > 2) {
      throw new BadRequestException('beneficiaries array cannot exceed 2 items');
    }
    if (updateData.methods && updateData.methods.length > 3) {
      throw new BadRequestException('methods array cannot exceed 3 items');
    }
    if (updateData.helpNeeded && updateData.helpNeeded.length > 3) {
      throw new BadRequestException('helpNeeded array cannot exceed 3 items');
    }

    const doc = await this.publicationPersistence.findById(publicationId);
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    // Get author ID before update for event publishing
    const authorId = publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();

    if (updateData.isPinned !== undefined) {
      const isAdmin = await this.communityService.isUserAdmin(communityId, userId);
      if (!isAdmin) {
        throw new BadRequestException('Only community administrators can pin or unpin posts');
      }
    }

    // Advanced settings (stopLoss, noAuthorWalletSpend, ttlDays) may be updated by the post author or by lead/superadmin for the publication's community
    const hasAdvancedSettingsUpdate =
      updateData.stopLoss !== undefined ||
      updateData.noAuthorWalletSpend !== undefined ||
      updateData.ttlDays !== undefined;
    if (hasAdvancedSettingsUpdate && userId !== authorId) {
      const docForSource = await this.getPublicationDocument(publicationId);
      const canAsSourceAdmin =
        !!docForSource &&
        (await this.isBirzhaSourceManagedPost(docForSource)) &&
        !!docForSource.sourceEntityId &&
        (await this.communityService.isUserAdmin(
          docForSource.sourceEntityId,
          userId,
        ));
      if (!canAsSourceAdmin) {
        const isElevated = await this.permissionService.isLeadOrSuperadmin(
          userId,
          communityId,
        );
        if (!isElevated) {
          throw new BadRequestException(
            'Only the post author can update advanced settings',
          );
        }
      }
    }

    // Authorization is handled by PermissionGuard via PermissionService.canEditPublication()
    // PermissionService already checks vote count and time window for authors
    // Leads and superadmins can edit regardless of votes/time, so no additional check needed here

    // Update publication fields
    if (updateData.content) {
      publication.updateContent(updateData.content);
    }
    if (updateData.hashtags) {
      publication.updateHashtags(updateData.hashtags);
    }
    if (updateData.categories !== undefined) {
      publication.updateCategories(updateData.categories || []);
    }
    if (updateData.valueTags !== undefined) {
      publication.updateValueTags(updateData.valueTags || []);
    }

    // Build combined update object
    // Start with snapshot (contains entity-managed fields: content, hashtags, metrics, etc.)
    const snapshot = publication.toSnapshot();
    const updatePayload: any = { ...snapshot };

    // Override readonly fields from updateData if provided
    // These fields are readonly in the entity, so we update them directly
    if (updateData.title !== undefined) {
      updatePayload.title = updateData.title;
    }
    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description;
    }
    // Always use images array, never imageUrl
    if (updateData.images !== undefined) {
      updatePayload.images = updateData.images || [];
      // Clear imageUrl to avoid conflicts
      updatePayload.imageUrl = null;
    }
    // Taxonomy fields
    if (updateData.impactArea !== undefined) {
      updatePayload.impactArea = updateData.impactArea || null;
    }
    if (updateData.beneficiaries !== undefined) {
      updatePayload.beneficiaries = updateData.beneficiaries || [];
    }
    if (updateData.methods !== undefined) {
      updatePayload.methods = updateData.methods || [];
    }
    if (updateData.stage !== undefined) {
      updatePayload.stage = updateData.stage || null;
    }
    if (updateData.helpNeeded !== undefined) {
      updatePayload.helpNeeded = updateData.helpNeeded || [];
    }
    // Categories field
    if (updateData.categories !== undefined) {
      updatePayload.categories = updateData.categories || [];
    }
    if (updateData.valueTags !== undefined) {
      updatePayload.valueTags = updateData.valueTags || [];
    }

    if ((doc as IPublicationDocument).postType === 'event') {
      if (updateData.eventStartDate !== undefined) {
        updatePayload.eventStartDate = updateData.eventStartDate;
      }
      if (updateData.eventEndDate !== undefined) {
        updatePayload.eventEndDate = updateData.eventEndDate;
      }
      if (updateData.eventTime !== undefined) {
        updatePayload.eventTime = updateData.eventTime;
      }
      if (updateData.eventLocation !== undefined) {
        updatePayload.eventLocation = updateData.eventLocation;
      }
      const nextStart =
        updateData.eventStartDate !== undefined
          ? updateData.eventStartDate
          : (doc as IPublicationDocument).eventStartDate;
      const nextEnd =
        updateData.eventEndDate !== undefined
          ? updateData.eventEndDate
          : (doc as IPublicationDocument).eventEndDate;
      if (nextStart && nextEnd && nextEnd < nextStart) {
        throw new BadRequestException('eventEndDate must be on or after eventStartDate');
      }
    }

    // Mutable advanced settings
    if (updateData.stopLoss !== undefined) {
      if (updateData.stopLoss < 0) {
        throw new BadRequestException('stopLoss must be >= 0');
      }
      updatePayload.stopLoss = updateData.stopLoss;
    }
    if (updateData.noAuthorWalletSpend !== undefined) {
      updatePayload.noAuthorWalletSpend = updateData.noAuthorWalletSpend;
    }
    if (updateData.isPinned !== undefined) {
      updatePayload.isPinned = updateData.isPinned;
    }

    // Conditionally mutable: ttlDays can only be increased
    if (updateData.ttlDays !== undefined) {
      const currentTtlDays = (doc as IPublicationDocument).ttlDays ?? null;
      const newTtlDays = updateData.ttlDays;
      const allowedValues = [7, 14, 30, 60, 90] as const;
      if (newTtlDays != null && !allowedValues.includes(newTtlDays)) {
        throw new BadRequestException(
          'ttlDays must be one of 7, 14, 30, 60, 90 or null',
        );
      }
      if (currentTtlDays != null && newTtlDays === null) {
        throw new BadRequestException(
          'TTL can only be increased, not removed',
        );
      }
      if (newTtlDays != null) {
        if (currentTtlDays != null && newTtlDays <= currentTtlDays) {
          throw new BadRequestException(
            'TTL can only be increased, not decreased',
          );
        }
        const createdAt =
          doc.createdAt instanceof Date
            ? doc.createdAt
            : new Date(doc.createdAt);
        updatePayload.ttlExpiresAt = new Date(
          createdAt.getTime() +
            newTtlDays * 24 * 60 * 60 * 1000,
        );
        updatePayload.ttlDays = newTtlDays;
      } else {
        updatePayload.ttlDays = null;
        updatePayload.ttlExpiresAt = null;
      }
    }

    // Single atomic update with all changes
    // Record edit history entry
    const editHistoryEntry = {
      editedBy: userId,
      editedAt: new Date(),
    };

    await this.publicationPersistence.updateWithEditHistory(
      publication.getId.getValue(),
      updatePayload,
      editHistoryEntry,
    );

    const updatedDoc = await this.publicationPersistence.findById(publicationId);
    const updatedPublication = updatedDoc ? Publication.fromSnapshot(updatedDoc as IPublicationDocument) : publication;

    // Publish domain event if editor is not the author
    if (userId !== authorId) {
      await this.eventBus.publish(
        new PublicationUpdatedEvent(
          publicationId,
          userId,
          authorId,
          communityId,
        ),
      );
      this.logger.log(
        `Publication updated event published: ${publicationId} by editor ${userId} (author: ${authorId})`,
      );
    }

    return updatedPublication;
  }

  async deletePublication(
    publicationId: string,
    _userId: string,
  ): Promise<boolean> {
    const publication = await this.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Authorization is handled by PermissionGuard via PermissionService.canDeletePublication()
    // No need for redundant check here

    // Soft delete: mark as deleted instead of removing from database
    // This preserves votes, comments, and all related data
    await this.publicationPersistence.softDelete(publicationId);
    return true;
  }

  /**
   * Restore a deleted publication
   * Only leads and superadmins can restore publications
   */
  async restorePublication(
    publicationId: string,
    _userId: string,
  ): Promise<boolean> {
    const publication = await this.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Check if publication is actually deleted
    const snapshot = publication.toSnapshot();
    if (!snapshot.deleted) {
      throw new BadRequestException('Publication is not deleted');
    }

    // Authorization is handled by PermissionGuard via PermissionService.canDeletePublication()
    // Restore uses the same permissions as delete (leads/superadmins only)

    // Restore: unmark as deleted
    await this.publicationPersistence.restore(publicationId);
    return true;
  }

  /**
   * Update forward proposal fields on a publication
   */
  async updateForwardProposal(
    publicationId: string,
    targetCommunityId: string,
    proposedBy: string,
  ): Promise<void> {
    await this.publicationPersistence.updateForwardProposal(publicationId, {
      targetCommunityId,
      proposedBy,
    });
  }

  /**
   * Mark publication as forwarded
   */
  async markAsForwarded(
    publicationId: string,
    targetCommunityId: string,
  ): Promise<void> {
    await this.publicationPersistence.markAsForwarded(publicationId, targetCommunityId);
  }

  /**
   * Clear forward proposal fields
   */
  async clearForwardProposal(publicationId: string): Promise<void> {
    await this.publicationPersistence.clearForwardProposal(publicationId);
  }

  /**
   * Find active publication IDs by source (e.g. project posts on Birzha).
   */
  async findActiveIdsBySource(
    communityId: string,
    sourceEntityType: string,
    sourceEntityId: string,
  ): Promise<string[]> {
    return this.publicationPersistence.findActiveIdsBySource(
      communityId,
      sourceEntityType,
      sourceEntityId,
    );
  }

  /**
   * Permanently delete a publication (hard delete)
   * This removes the publication, all its votes, and all its comments from the database
   * Only leads and superadmins can permanently delete publications
   * 
   * NOTE: This method does NOT handle auto-withdrawal of balances.
   * The caller should handle that before calling this method if needed.
   * 
   * WARNING: This is a destructive operation that cannot be undone.
   */
  async permanentDeletePublication(
    publicationId: string,
    _userId: string,
  ): Promise<boolean> {
    const publication = await this.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Authorization is handled by PermissionGuard via PermissionService.canDeletePublication()
    // No need for redundant check here

    await this.publicationPersistence.deleteVotesByPublicationId(publicationId);
    await this.publicationPersistence.deleteCommentsRecursivelyForPublication(publicationId);
    await this.publicationPersistence.deleteById(publicationId);

    this.logger.log(`Permanently deleted publication: ${publicationId}`);
    return true;
  }
}
