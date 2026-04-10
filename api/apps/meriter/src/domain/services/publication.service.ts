import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
import { Publication } from '../aggregates/publication/publication.entity';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import {
  PublicationId,
  UserId,
  CommunityId,
} from '../value-objects';
import { PublicationCreatedEvent, PublicationUpdatedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { PublicationDocument as IPublicationDocument } from '../../common/interfaces/publication-document.interface';
import { PermissionService } from './permission.service';
import { CommunityService } from './community.service';
import { UserCommunityRoleService } from './user-community-role.service';
import { UserService } from './user.service';
import { CommunityWalletService } from './community-wallet.service';
import { WalletService } from './wallet.service';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';

export interface CreatePublicationDto {
  communityId: string;
  title?: string;
  description?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  postType?: 'basic' | 'poll' | 'project' | 'ticket' | 'discussion';
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
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => PermissionService))
    private permissionService: PermissionService,
    @Inject(forwardRef(() => CommunityService))
    private communityService: CommunityService,
    private userCommunityRoleService: UserCommunityRoleService,
    @Inject(forwardRef(() => UserService))
    private userService: UserService,
    private communityWalletService: CommunityWalletService,
    @Inject(forwardRef(() => WalletService))
    private walletService: WalletService,
  ) {}

  async createPublication(
    userId: string,
    dto: CreatePublicationDto,
  ): Promise<Publication> {
    this.logger.log(
      `Creating publication: user=${userId}, community=${dto.communityId}`,
    );

    // Validate using value objects
    const authorId = UserId.fromString(userId);
    const _communityId = CommunityId.fromString(dto.communityId);

    const community = await this.communityService.getCommunity(dto.communityId);
    if (community?.isProject) {
      if (dto.postType !== 'ticket' && dto.postType !== 'discussion') {
        throw new BadRequestException(
          'When creating a post in a project community, postType must be "ticket" or "discussion"',
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

    // Validate array lengths
    if (dto.beneficiaries && dto.beneficiaries.length > 2) {
      throw new BadRequestException('beneficiaries array cannot exceed 2 items');
    }
    if (dto.methods && dto.methods.length > 3) {
      throw new BadRequestException('methods array cannot exceed 3 items');
    }
    if (dto.helpNeeded && dto.helpNeeded.length > 3) {
      throw new BadRequestException('helpNeeded array cannot exceed 3 items');
    }

    const postingAsCommunity =
      dto.sourceEntityType === 'community' && !!dto.sourceEntityId;

    // Create publication aggregate
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

    // Save to database using Mongoose directly
    // Include additional fields from DTO that are not in the aggregate snapshot
    const publicationSnapshot = publication.toSnapshot();
    const createdAt = new Date();
    const ttlExpiresAt =
      dto.ttlDays != null && dto.ttlDays > 0
        ? new Date(createdAt.getTime() + dto.ttlDays * 24 * 60 * 60 * 1000)
        : dto.ttlExpiresAt ?? null;

    await this.publicationModel.create({
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
      sourceEntityId: dto.sourceEntityId,
      sourceEntityType: dto.sourceEntityType,
      valueTags: dto.valueTags ?? [],
    });

    // Publish domain event
    await this.eventBus.publish(
      new PublicationCreatedEvent(
        publication.getId.getValue(),
        userId,
        dto.communityId,
      ),
    );

    this.logger.log(
      `Publication created successfully: ${publication.getId.getValue()}`,
    );
    return publication;
  }

  /**
   * Backdates publication timestamps for platform baseline seed so posts appear spread over time.
   * Recalculates ttlExpiresAt from ttlDays when set (investing posts).
   */
  async setPublicationTimestampsForSeed(
    publicationId: string,
    createdAt: Date,
  ): Promise<void> {
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
    if (!doc) return;
    const ttlDays = doc.ttlDays;
    const ttlExpiresAt =
      ttlDays != null && ttlDays > 0
        ? new Date(createdAt.getTime() + ttlDays * 24 * 60 * 60 * 1000)
        : doc.ttlExpiresAt ?? null;
    await this.publicationModel.updateOne(
      { id: publicationId },
      { $set: { createdAt, updatedAt: createdAt, ttlExpiresAt } },
    );
  }

  /**
   * Birzha (МД) post from a project or eligible local community.
   * postCost from CommunityWallet(sourceEntityId); rights validated here (source admin).
   */
  async publishSourceEntityToBirzha(params: {
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
    /** Default: deduct postCost from source CommunityWallet. */
    postCostFunding?: 'source_community_wallet' | 'caller_global_wallet';
    /** When false, create post without investing (project or community source). */
    investingEnabled?: boolean;
    /** project: share when investing on; community: share when investing on Birzha */
    investorSharePercent?: number;
    ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
    stopLoss?: number;
    noAuthorWalletSpend?: boolean;
  }): Promise<{ id: string }> {
    const birzha = await this.communityService.getCommunityByTypeTag(
      'marathon-of-good',
    );
    if (!birzha) {
      throw new NotFoundException(
        'Birzha community (marathon-of-good) not found',
      );
    }

    const source = await this.communityService.getCommunity(params.sourceEntityId);
    if (!source) {
      throw new NotFoundException('Source community not found');
    }

    if (
      !(await this.communityService.isUserAdmin(
        params.sourceEntityId,
        params.callerId,
      ))
    ) {
      throw new ForbiddenException(
        'You are not allowed to publish on behalf of this source',
      );
    }

    if (params.sourceEntityType === 'project') {
      if (!source.isProject) {
        throw new BadRequestException('Source is not a project community');
      }
    } else {
      this.communityService.assertEligibleCommunitySourceForBirzhaPublish(
        source,
      );
    }

    if (params.beneficiaryId) {
      const beneficiaryUser = await this.userService.getUserById(
        params.beneficiaryId,
      );
      if (!beneficiaryUser) {
        throw new BadRequestException('Beneficiary must be a registered user');
      }
    }

    const minPct = birzha.settings?.investorShareMin ?? 1;
    const maxPct = birzha.settings?.investorShareMax ?? 99;
    const requireTTLForInvestPosts =
      birzha.settings?.requireTTLForInvestPosts ?? false;

    let investorSharePercent = 0;
    let investingEnabled = false;

    if (params.sourceEntityType === 'project') {
      if (params.investingEnabled === false) {
        investingEnabled = false;
        investorSharePercent = 0;
      } else {
        const raw =
          params.investorSharePercent ??
          source.investorSharePercent ??
          minPct;
        investorSharePercent = raw;
        if (investorSharePercent < minPct || investorSharePercent > maxPct) {
          throw new BadRequestException(
            `investorSharePercent must be between ${minPct} and ${maxPct}`,
          );
        }
        investingEnabled = investorSharePercent > 0;
      }
    } else {
      // Local community source: same contract rules as project Birzha posts
      if (params.investingEnabled === false) {
        investingEnabled = false;
        investorSharePercent = 0;
      } else {
        const raw = params.investorSharePercent ?? minPct;
        investorSharePercent = raw;
        if (investorSharePercent < minPct || investorSharePercent > maxPct) {
          throw new BadRequestException(
            `investorSharePercent must be between ${minPct} and ${maxPct}`,
          );
        }
        investingEnabled = investorSharePercent > 0;
      }
    }

    if (requireTTLForInvestPosts && investingEnabled) {
      if (params.ttlDays == null || params.ttlDays === undefined) {
        throw new BadRequestException(
          'TTL is required for posts with investing on Birzha',
        );
      }
    }

    const stopLoss = params.stopLoss ?? 0;
    if (stopLoss < 0) {
      throw new BadRequestException('stopLoss must be 0 or greater');
    }

    const id = PublicationId.generate().getValue();
    const postCost = birzha.settings?.postCost ?? 1;
    const funding =
      params.postCostFunding ?? 'source_community_wallet';

    await this.communityWalletService.createWallet(params.sourceEntityId);

    if (postCost > 0) {
      if (funding === 'source_community_wallet') {
        await this.communityWalletService.deductBalance(
          params.sourceEntityId,
          postCost,
          'birzha_post_cost',
        );
      } else {
        const wallet = await this.walletService.getWallet(
          params.callerId,
          GLOBAL_COMMUNITY_ID,
        );
        const balance = wallet ? wallet.getBalance() : 0;
        if (balance < postCost) {
          throw new BadRequestException(
            `Insufficient wallet merits. Available: ${balance}, Required: ${postCost}`,
          );
        }
        const globalCommunity =
          await this.communityService.getCommunity(GLOBAL_COMMUNITY_ID);
        const feeCurrency = globalCommunity?.settings?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        };
        await this.walletService.addTransaction(
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

    await this.publicationModel.create({
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

    await this.eventBus.publish(
      new PublicationCreatedEvent(id, params.callerId, birzhaId),
    );

    this.logger.log(
      `Birzha publication from ${params.sourceEntityType} ${params.sourceEntityId}: ${id}`,
    );
    return { id };
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
    const doc = await this.publicationModel.findOne({ id: publicationId }).lean();
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

    await this.publicationModel.create({
      id,
      communityId: params.futureVisionCommunityId,
      authorId: params.authorId,
      sourceEntityId: params.sourceEntityId,
      sourceEntityType: 'community',
      content: params.content,
      type: 'text',
      title: undefined,
      description: undefined,
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
    const updated = await this.publicationModel
      .findOneAndUpdate(
        {
          communityId: futureVisionCommunityId,
          sourceEntityType: 'community',
          sourceEntityId: sourceCommunityId,
          deleted: { $ne: true },
        },
        {
          $set: {
            content,
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    if (updated) {
      this.logger.log(
        `OB post content updated for community ${sourceCommunityId}`,
      );
    }
    return !!updated;
  }

  /**
   * Find OB publication id by source community (if any).
   */
  async findFutureVisionPostId(
    futureVisionCommunityId: string,
    sourceCommunityId: string,
  ): Promise<string | null> {
    const doc = await this.publicationModel
      .findOne({
        communityId: futureVisionCommunityId,
        sourceEntityType: 'community',
        sourceEntityId: sourceCommunityId,
        deleted: { $ne: true },
      })
      .select('id')
      .lean()
      .exec();
    return doc?.id ?? null;
  }

  /**
   * List OB posts in future-vision community, sorted by metrics.score descending.
   * Used for getFutureVisions feed.
   */
  async findObPostsSortedByScore(
    futureVisionCommunityId: string,
  ): Promise<{ id: string; sourceEntityId: string; metrics: { score: number } }[]> {
    const docs = await this.publicationModel
      .find({
        communityId: futureVisionCommunityId,
        sourceEntityType: 'community',
        deleted: { $ne: true },
      })
      .select('id sourceEntityId metrics.score')
      .sort({ 'metrics.score': -1 })
      .lean()
      .exec();
    return docs.map((d: any) => ({
      id: d.id,
      sourceEntityId: d.sourceEntityId,
      metrics: { score: d.metrics?.score ?? 0 },
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
    const docs = await this.publicationModel
      .find({
        communityId: futureVisionCommunityId,
        sourceEntityType: 'community',
        deleted: { $ne: true },
      })
      .select('id sourceEntityId metrics.score createdAt')
      .sort(
        params.sort === 'createdAt'
          ? { createdAt: -1 }
          : { 'metrics.score': -1 },
      )
      .lean()
      .exec();

    return docs.map((d: any) => ({
      id: d.id,
      sourceEntityId: d.sourceEntityId,
      metrics: { score: d.metrics?.score ?? 0 },
      createdAt: d.createdAt ? new Date(d.createdAt) : new Date(0),
    }));
  }

  async getPublication(id: string): Promise<Publication | null> {
    // Direct Mongoose query
    const doc = await this.publicationModel.findOne({ id }).lean();
    return doc ? Publication.fromSnapshot(doc as IPublicationDocument) : null;
  }

  /** Count active Birzha posts for a source entity (same filter as {@link getBirzhaPostsBySourceEntity}). */
  async countBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
  ): Promise<number> {
    return this.publicationModel.countDocuments({
      communityId: birzhaCommunityId,
      sourceEntityType,
      sourceEntityId,
      deleted: { $ne: true },
    });
  }

  /** Active posts on Birzha (МД) for a given source entity. */
  async getBirzhaPostsBySourceEntity(
    birzhaCommunityId: string,
    sourceEntityType: 'project' | 'community',
    sourceEntityId: string,
    limit: number,
    skip: number,
  ): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({
        communityId: birzhaCommunityId,
        sourceEntityType,
        sourceEntityId,
        deleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
    return docs.map((d) =>
      Publication.fromSnapshot(d as IPublicationDocument),
    );
  }

  /** Get raw publication document (for investment checks, etc.) */
  async getPublicationDocument(
    id: string,
  ): Promise<IPublicationDocument | null> {
    const doc = await this.publicationModel.findOne({ id }).lean().exec();
    return doc as IPublicationDocument | null;
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
  ): Promise<Publication[]> {
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build query - exclude deleted items
    const query: Record<string, unknown> = { communityId, deleted: { $ne: true } };

    const searchOr =
      search && search.trim()
        ? (() => {
            const escapedSearch = escapeRe(search.trim());
            const searchRegex = new RegExp(escapedSearch, 'i');
            return [
              { content: searchRegex },
              { title: searchRegex },
              { description: searchRegex },
              { hashtags: searchRegex },
            ];
          })()
        : null;

    const valueTagOr =
      filters?.valueTags && filters.valueTags.length > 0
        ? filters.valueTags.map((t) => {
            const escaped = escapeRe(t.trim());
            return { valueTags: new RegExp(`^${escaped}$`, 'i') };
          })
        : null;

    if (searchOr && valueTagOr) {
      query.$and = [{ $or: searchOr }, { $or: valueTagOr }];
    } else if (searchOr) {
      query.$or = searchOr;
    } else if (valueTagOr) {
      query.$or = valueTagOr;
    }

    // Apply hashtag filter if provided
    if (hashtag) {
      query.hashtags = hashtag;
    }

    // Apply taxonomy filters with OR semantics for array fields
    if (filters) {
      if (filters.impactArea) {
        query.impactArea = filters.impactArea;
      }
      if (filters.stage) {
        query.stage = filters.stage;
      }
      // Array fields: item matches if it has ANY of the selected tags (OR)
      if (filters.beneficiaries && filters.beneficiaries.length > 0) {
        query.beneficiaries = { $in: filters.beneficiaries };
      }
      if (filters.methods && filters.methods.length > 0) {
        query.methods = { $in: filters.methods };
      }
      if (filters.helpNeeded && filters.helpNeeded.length > 0) {
        query.helpNeeded = { $in: filters.helpNeeded };
      }
      // Category filter: publication must have at least one of the selected categories
      if (filters.categories && filters.categories.length > 0) {
        query.categories = { $in: filters.categories };
      }
    }

    // Build sort object
    const sort: Record<string, 1 | -1> = {};
    if (sortBy === 'score') {
      sort['metrics.score'] = -1;
    } else {
      sort.createdAt = -1;
    }

    // Direct Mongoose query - no repository wrapper needed
    const docs = await this.publicationModel
      .find(query)
      .limit(limit)
      .skip(skip)
      .sort(sort)
      .lean();

    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  async getTopPublications(
    limit: number = 20,
    skip: number = 0,
  ): Promise<Publication[]> {
    // Direct Mongoose query - exclude deleted items
    const docs = await this.publicationModel
      .find({ deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean();

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

    // Load aggregate using Mongoose directly
    const doc = await this.publicationModel
      .findOne({ id: id.getValue() })
      .lean();
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    // Business logic in domain
    const voteAmount = direction === 'up' ? amount : -amount;
    publication.vote(voteAmount);

    // Save. D-8: track lastEarnedAt when post earns (positive vote).
    const snapshot = publication.toSnapshot();
    if (direction === 'up' && amount > 0) {
      snapshot.lastEarnedAt = new Date();
    }
    const updateOp: Record<string, unknown> = { $set: snapshot };
    // Track total ever earned for closingSummary.totalEarned (only positive credits)
    if (voteAmount > 0) {
      updateOp.$inc = { lifetimeCredits: voteAmount };
    }
    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      updateOp,
    );

    return publication;
  }

  async reduceScore(
    publicationId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<Publication> {
    const id = PublicationId.fromString(publicationId);

    const query = this.publicationModel.findOne({ id: id.getValue() });
    if (session) query.session(session);
    const doc = await query.lean().exec();
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    publication.reduceScore(amount);

    const opts = session ? { session } : {};
    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      { $set: publication.toSnapshot() },
      opts,
    );

    return publication;
  }

  async getPublicationsByAuthor(
    authorId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({ authorId, deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();

    return docs.map((doc) =>
      Publication.fromSnapshot(doc as IPublicationDocument),
    );
  }

  /**
   * Count active publications by author excluding project posts (aligns with profile publications tab).
   */
  async countProfilePublicationsByAuthor(authorId: string): Promise<number> {
    return this.publicationModel.countDocuments({
      authorId,
      deleted: { $ne: true },
      $nor: [{ isProject: true }, { postType: 'project' }],
    });
  }

  async getPublicationsByHashtag(
    hashtag: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({ hashtags: hashtag, deleted: { $ne: true } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();

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
    // Build query for deleted items
    const query: any = { communityId, deleted: true };

    // Direct Mongoose query
    const docs = await this.publicationModel
      .find(query)
      .limit(limit)
      .skip(skip)
      .sort({ deletedAt: -1, createdAt: -1 })
      .lean();

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

    const doc = await this.publicationModel
      .findOne({ id: publicationId })
      .lean();
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    // Get author ID before update for event publishing
    const authorId = publication.getAuthorId.getValue();
    const communityId = publication.getCommunityId.getValue();

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

    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      {
        $set: updatePayload,
        $push: { editHistory: editHistoryEntry },
      },
    );

    // Reload to return updated publication
    const updatedDoc = await this.publicationModel.findOne({ id: publicationId }).lean();
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
    await this.publicationModel.updateOne(
      { id: publicationId },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
        },
      },
    );
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
    await this.publicationModel.updateOne(
      { id: publicationId },
      {
        $unset: {
          deleted: '',
          deletedAt: '',
        },
      },
    );
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
    await this.publicationModel.updateOne(
      { id: publicationId },
      {
        $set: {
          forwardStatus: 'pending',
          forwardTargetCommunityId: targetCommunityId,
          forwardProposedBy: proposedBy,
          forwardProposedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  /**
   * Mark publication as forwarded
   */
  async markAsForwarded(
    publicationId: string,
    targetCommunityId: string,
  ): Promise<void> {
    await this.publicationModel.updateOne(
      { id: publicationId },
      {
        $set: {
          forwardStatus: 'forwarded',
          forwardTargetCommunityId: targetCommunityId,
          updatedAt: new Date(),
        },
        $unset: {
          forwardProposedBy: '',
          forwardProposedAt: '',
        },
      },
    );
  }

  /**
   * Clear forward proposal fields
   */
  async clearForwardProposal(publicationId: string): Promise<void> {
    await this.publicationModel.updateOne(
      { id: publicationId },
      {
        $set: {
          forwardStatus: null,
          updatedAt: new Date(),
        },
        $unset: {
          forwardTargetCommunityId: '',
          forwardProposedBy: '',
          forwardProposedAt: '',
        },
      },
    );
  }

  /**
   * Find active publication IDs by source (e.g. project posts on Birzha).
   */
  async findActiveIdsBySource(
    communityId: string,
    sourceEntityType: string,
    sourceEntityId: string,
  ): Promise<string[]> {
    const list = await this.publicationModel
      .find({
        communityId,
        sourceEntityType,
        sourceEntityId,
        status: 'active',
        deleted: { $ne: true },
      })
      .select('id')
      .lean()
      .exec();
    return list.map((d) => d.id);
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

    // Use a helper function to recursively delete all comments on this publication
    // and their replies
    const deleteCommentsRecursively = async (targetId: string, targetType: 'publication' | 'comment') => {
      if (!this.mongoose.db) {
        throw new Error('Database connection not available');
      }

      // Find all comments on this publication or comment
      const comments = await this.mongoose.db
        .collection('comments')
        .find({ targetType, targetId })
        .toArray();

      // Recursively delete replies first
      for (const comment of comments) {
        await deleteCommentsRecursively(comment.id, 'comment');
      }

      // Delete all comments found
      if (comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        await this.mongoose.db
          .collection('comments')
          .deleteMany({ id: { $in: commentIds } });
      }
    };

    // Delete all votes on this publication
    // (Votes on comments will be deleted when comments are deleted)
    if (this.mongoose.db) {
      await this.mongoose.db
        .collection('votes')
        .deleteMany({ targetType: 'publication', targetId: publicationId });
    }

    // Delete all comments on this publication (and their replies recursively)
    await deleteCommentsRecursively(publicationId, 'publication');

    // Finally, delete the publication itself
    await this.publicationModel.deleteOne({ id: publicationId });

    this.logger.log(`Permanently deleted publication: ${publicationId}`);
    return true;
  }
}
