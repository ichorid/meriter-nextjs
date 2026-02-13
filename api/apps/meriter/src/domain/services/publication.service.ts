import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
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

export interface CreatePublicationDto {
  communityId: string;
  title?: string;
  description?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  postType?: 'basic' | 'poll' | 'project';
  isProject?: boolean;
  hashtags?: string[];
  categories?: string[]; // Array of category IDs
  images?: string[]; // Array of image URLs for multi-image support
  videoUrl?: string;
  beneficiaryId?: string;
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
  ) { }

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

  async getPublication(id: string): Promise<Publication | null> {
    // Direct Mongoose query
    const doc = await this.publicationModel.findOne({ id }).lean();
    return doc ? Publication.fromSnapshot(doc as IPublicationDocument) : null;
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
    },
    search?: string,
  ): Promise<Publication[]> {
    // Build query - exclude deleted items
    const query: any = { communityId, deleted: { $ne: true } };

    // Apply search filter if provided
    if (search && search.trim()) {
      // Escape special regex characters for security
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      query.$or = [
        { content: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { hashtags: searchRegex },
      ];
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
    const sort: any = {};
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

    // Only the post author may update advanced settings (stopLoss, noAuthorWalletSpend, ttlDays)
    const hasAdvancedSettingsUpdate =
      updateData.stopLoss !== undefined ||
      updateData.noAuthorWalletSpend !== undefined ||
      updateData.ttlDays !== undefined;
    if (hasAdvancedSettingsUpdate && userId !== authorId) {
      throw new BadRequestException(
        'Only the post author can update advanced settings',
      );
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
   * Get publication document (for accessing raw fields)
   */
  async getPublicationDocument(publicationId: string): Promise<any> {
    return await this.publicationModel.findOne({ id: publicationId }).lean();
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
