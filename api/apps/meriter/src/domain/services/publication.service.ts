import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
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
import { PublicationCreatedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { PublicationDocument as IPublicationDocument } from '../../common/interfaces/publication-document.interface';

export interface CreatePublicationDto {
  communityId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  beneficiaryId?: string;
  hashtags?: string[];
  imageUrl?: string;
  videoUrl?: string;
  postType?: 'basic' | 'poll' | 'project';
  isProject?: boolean;
  title?: string;
  description?: string;
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
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
    const communityId = CommunityId.fromString(dto.communityId);

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
      authorId,
      communityId,
      dto.content,
      dto.type,
      {
        beneficiaryId: dto.beneficiaryId
          ? UserId.fromString(dto.beneficiaryId)
          : undefined,
        hashtags: dto.hashtags,
        imageUrl: dto.imageUrl,
        videoUrl: dto.videoUrl,
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
    await this.publicationModel.create({
      ...publicationSnapshot,
      postType: dto.postType || 'basic',
      isProject: dto.isProject || false,
      title: dto.title,
      description: dto.description,
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
    },
  ): Promise<Publication[]> {
    // Build query
    const query: any = { communityId };

    // Apply hashtag filter if provided
    if (hashtag) {
      query.hashtags = hashtag;
    }

    // Apply taxonomy filters with AND semantics
    if (filters) {
      if (filters.impactArea) {
        query.impactArea = filters.impactArea;
      }
      if (filters.stage) {
        query.stage = filters.stage;
      }
      // Array fields: all selected items must be present (AND)
      if (filters.beneficiaries && filters.beneficiaries.length > 0) {
        query.beneficiaries = { $all: filters.beneficiaries };
      }
      if (filters.methods && filters.methods.length > 0) {
        query.methods = { $all: filters.methods };
      }
      if (filters.helpNeeded && filters.helpNeeded.length > 0) {
        query.helpNeeded = { $all: filters.helpNeeded };
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
    // Direct Mongoose query
    const docs = await this.publicationModel
      .find({})
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

    // Save
    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      { $set: publication.toSnapshot() },
    );

    return publication;
  }

  async reduceScore(publicationId: string, amount: number): Promise<Publication> {
    const id = PublicationId.fromString(publicationId);

    // Load aggregate
    const doc = await this.publicationModel
      .findOne({ id: id.getValue() })
      .lean();
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);

    // Reduce score
    publication.reduceScore(amount);

    // Save
    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      { $set: publication.toSnapshot() },
    );

    return publication;
  }

  async getPublicationsByAuthor(
    authorId: string,
    limit: number = 50,
    skip: number = 0,
  ): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({ authorId })
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
      .find({ hashtags: hashtag })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
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
    if (updateData.imageUrl !== undefined) {
      updatePayload.imageUrl = updateData.imageUrl || null;
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

    // Single atomic update with all changes
    await this.publicationModel.updateOne(
      { id: publication.getId.getValue() },
      { $set: updatePayload },
    );

    // Reload to return updated publication
    const updatedDoc = await this.publicationModel.findOne({ id: publicationId }).lean();
    return updatedDoc ? Publication.fromSnapshot(updatedDoc as IPublicationDocument) : publication;
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

    await this.publicationModel.deleteOne({ id: publicationId });
    return true;
  }
}
