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
  Publication as PublicationSchema,
  PublicationDocument,
} from '../models/publication/publication.schema';
import {
  PublicationId,
  UserId,
  CommunityId,
  PublicationContent,
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
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    @InjectModel(PublicationSchema.name)
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
  ): Promise<Publication[]> {
    // Build query
    const query: any = { communityId };

    // Apply hashtag filter if provided
    if (hashtag) {
      query.hashtags = hashtag;
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
    const doc = await this.publicationModel
      .findOne({ id: publicationId })
      .lean();
    if (!doc) {
      throw new NotFoundException('Publication not found');
    }

    const publication = Publication.fromSnapshot(doc as IPublicationDocument);
    const userIdObj = UserId.fromString(userId);

    if (!publication.canBeEditedBy(userIdObj)) {
      throw new Error('Not authorized to edit this publication');
    }

    // Update publication fields
    if (updateData.content) {
      publication.updateContent(updateData.content);
    }
    if (updateData.hashtags) {
      publication.updateHashtags(updateData.hashtags);
    }

    await this.publicationModel.updateOne(
      { id: publication.getId },
      { $set: publication.toSnapshot() },
    );

    return publication;
  }

  async deletePublication(
    publicationId: string,
    userId: string,
  ): Promise<boolean> {
    const publication = await this.getPublication(publicationId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    const userIdObj = UserId.fromString(userId);
    if (!publication.canBeDeletedBy(userIdObj)) {
      throw new Error('Not authorized to delete this publication');
    }

    await this.publicationModel.deleteOne({ id: publicationId });
    return true;
  }
}
