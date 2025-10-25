import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PublicationRepository } from '../models/publication/publication.repository';
import { CommunityRepository } from '../models/community/community.repository';
import { UserRepository } from '../models/user/user.repository';
import { Publication } from '../models/publication/publication.schema';
import { PublicationContent, CommunityId, UserId } from '../value-objects';
import { PublicationCreatedEvent, PublicationVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { v4 as uuidv4 } from 'uuid';

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
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    private publicationRepository: PublicationRepository,
    private communityRepository: CommunityRepository,
    private userRepository: UserRepository,
    private eventBus: EventBus,
  ) {}

  async createPublication(userId: string, dto: CreatePublicationDto): Promise<Publication> {
    this.logger.log(`Creating publication: user=${userId}, community=${dto.communityId}`);

    // Validate using value objects
    const content = PublicationContent.create(dto.content);
    const communityId = CommunityId.fromString(dto.communityId);
    const authorId = UserId.fromString(userId);

    // Validate community exists
    const community = await this.communityRepository.findById(communityId.getValue());
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Validate beneficiary if provided
    if (dto.beneficiaryId) {
      const beneficiary = await this.userRepository.findById(dto.beneficiaryId);
      if (!beneficiary) {
        throw new NotFoundException('Beneficiary not found');
      }
    }

    // Validate hashtags against community hashtags
    if (dto.hashtags && dto.hashtags.length > 0) {
      const invalidHashtags = dto.hashtags.filter(tag => !community.hashtags.includes(tag));
      if (invalidHashtags.length > 0) {
        throw new BadRequestException(`Invalid hashtags: ${invalidHashtags.join(', ')}`);
      }
    }

    const publication = await this.publicationRepository.create({
      id: uuidv4(),
      communityId: communityId.getValue(),
      authorId: authorId.getValue(),
      beneficiaryId: dto.beneficiaryId,
      content: content.getValue(),
      type: dto.type,
      hashtags: dto.hashtags || [],
      imageUrl: dto.imageUrl,
      videoUrl: dto.videoUrl,
      metrics: {
        upthanks: 0,
        downthanks: 0,
        score: 0,
        commentCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Publish domain event
    await this.eventBus.publish(
      new PublicationCreatedEvent(publication.id, userId, dto.communityId)
    );

    this.logger.log(`Publication created successfully: ${publication.id}`);
    return publication;
  }

  async getPublication(id: string): Promise<Publication | null> {
    return this.publicationRepository.findById(id);
  }

  async getPublicationsByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.publicationRepository.findByCommunity(communityId, limit, skip);
  }

  async getPublicationsByAuthor(authorId: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.publicationRepository.findByAuthor(authorId, limit, skip);
  }

  async getPublicationsByHashtag(hashtag: string, limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.publicationRepository.findByHashtag(hashtag, limit, skip);
  }

  async getTopPublications(limit: number = 20, skip: number = 0): Promise<Publication[]> {
    return this.publicationRepository.findByScore(limit, skip);
  }

  async updatePublication(id: string, userId: string, updates: Partial<CreatePublicationDto>): Promise<Publication | null> {
    const publication = await this.publicationRepository.findById(id);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    if (publication.authorId !== userId) {
      throw new BadRequestException('Only the author can update this publication');
    }

    // Validate content if provided
    if (updates.content) {
      PublicationContent.create(updates.content);
    }

    return this.publicationRepository.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deletePublication(id: string, userId: string): Promise<void> {
    const publication = await this.publicationRepository.findById(id);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    if (publication.authorId !== userId) {
      throw new BadRequestException('Only the author can delete this publication');
    }

    await this.publicationRepository.delete(id);
  }

  async voteOnPublication(publicationId: string, userId: string, amount: number, direction: 'up' | 'down'): Promise<Publication> {
    const publication = await this.publicationRepository.findById(publicationId);
    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    // Update metrics
    const delta = direction === 'up' ? amount : -amount;
    const updated = await this.publicationRepository.updateMetrics(publicationId, delta);

    if (!updated) {
      throw new NotFoundException('Failed to update publication');
    }

    // Publish event
    await this.eventBus.publish(
      new PublicationVotedEvent(publicationId, userId, amount, direction)
    );

    return updated;
  }
}
