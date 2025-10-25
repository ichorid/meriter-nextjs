import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession } from 'mongoose';
import { Publication } from '../aggregates/publication/publication.entity';
import { Publication as PublicationSchema, PublicationDocument } from '../models/publication/publication.schema';
import { PublicationId, UserId, CommunityId, PublicationContent } from '../value-objects';
import { PublicationCreatedEvent, PublicationVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';

export interface CreatePublicationDto {
  communityId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  beneficiaryId?: string;
  hashtags?: string[];
  imageUrl?: string;
  videoUrl?: string;
}

@Injectable()
export class PublicationServiceV2 {
  private readonly logger = new Logger(PublicationServiceV2.name);

  constructor(
    @InjectModel(PublicationSchema.name) private publicationModel: Model<PublicationDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async createPublication(userId: string, dto: CreatePublicationDto): Promise<Publication> {
    this.logger.log(`Creating publication: user=${userId}, community=${dto.communityId}`);

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
        beneficiaryId: dto.beneficiaryId ? UserId.fromString(dto.beneficiaryId) : undefined,
        hashtags: dto.hashtags,
        imageUrl: dto.imageUrl,
        videoUrl: dto.videoUrl,
      }
    );

    // Save to database using Mongoose directly
    await this.publicationModel.create(publication.toSnapshot());

    // Publish domain event
    await this.eventBus.publish(
      new PublicationCreatedEvent(publication.getId.getValue(), userId, dto.communityId)
    );

    this.logger.log(`Publication created successfully: ${publication.getId.getValue()}`);
    return publication;
  }

  async getPublication(id: string): Promise<Publication | null> {
    // Direct Mongoose query
    const doc = await this.publicationModel.findOne({ id }).lean();
    return doc ? Publication.fromSnapshot(doc as any) : null;
  }

  async getPublicationsByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    // Direct Mongoose query - no repository wrapper needed
    const docs = await this.publicationModel
      .find({ communityId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Publication.fromSnapshot(doc as any));
  }

  async getTopPublications(limit: number = 20, skip: number = 0): Promise<Publication[]> {
    // Direct Mongoose query
    const docs = await this.publicationModel
      .find({})
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean();
    
    return docs.map(doc => Publication.fromSnapshot(doc as any));
  }

  async voteOnPublication(publicationId: string, userId: string, amount: number, direction: 'up' | 'down'): Promise<Publication> {
    const id = PublicationId.fromString(publicationId);
    const session = await this.mongoose.startSession();
    
    session.startTransaction();

    try {
      // Load aggregate using Mongoose directly
      const doc = await this.publicationModel.findOne({ id: id.getValue() }, null, { session }).lean();
      if (!doc) {
        throw new NotFoundException('Publication not found');
      }

      const publication = Publication.fromSnapshot(doc as any);

      // Business logic in domain
      const voteAmount = direction === 'up' ? amount : -amount;
      publication.vote(voteAmount);

      // Save with session for atomicity
      await this.publicationModel.updateOne(
        { id: publication.getId.getValue() },
        { $set: publication.toSnapshot() },
        { session }
      );

      // Commit transaction
      await session.commitTransaction();

      // Publish event (outside transaction)
      await this.eventBus.publish(
        new PublicationVotedEvent(publicationId, userId, amount, direction)
      );

      return publication;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getPublicationsByAuthor(authorId: string, limit: number = 50, skip: number = 0): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({ authorId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Publication.fromSnapshot(doc as any));
  }

  async getPublicationsByHashtag(hashtag: string, limit: number = 50, skip: number = 0): Promise<Publication[]> {
    const docs = await this.publicationModel
      .find({ hashtags: hashtag })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Publication.fromSnapshot(doc as any));
  }

  async updatePublication(publicationId: string, userId: string, updateData: Partial<CreatePublicationDto>): Promise<Publication> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const doc = await this.publicationModel.findOne({ id: publicationId }, null, { session }).lean();
      if (!doc) {
        throw new NotFoundException('Publication not found');
      }

      const publication = Publication.fromSnapshot(doc as any);
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
        { session }
      );

      await session.commitTransaction();
      return publication;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async deletePublication(publicationId: string, userId: string): Promise<boolean> {
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
