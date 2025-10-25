import { Injectable, Logger } from '@nestjs/common';
import { PublicationsService as LegacyPublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Publication, CreatePublicationDto } from '../types/domain.types';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private readonly legacyPublicationsService: LegacyPublicationsService,
    private readonly tgBotsService: TgBotsService,
  ) {}

  async getPublications(pagination: any, filters: any): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Build query based on filters
    const query: any = {};
    
    if (filters.type) {
      query.type = filters.type;
    }
    
    if (filters.communityId) {
      query['meta.origin.telegramChatId'] = filters.communityId;
    }
    
    if (filters.spaceId) {
      query['meta.hashtagSlug'] = filters.spaceId;
    }

    const publications = await this.legacyPublicationsService.model
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.legacyPublicationsService.model.countDocuments(query);

    const mappedPublications = publications.map(pub => this.mapToPublication(pub));

    return PaginationHelper.createResult(mappedPublications, total, pagination);
  }

  async getPublication(id: string, userId: string): Promise<Publication | null> {
    const publication = await this.legacyPublicationsService.model.findOne({
      uid: id,
    });

    if (!publication) {
      return null;
    }

    // Check if user has access to this publication
    const telegramCommunityChatId = publication.meta?.origin?.telegramChatId;
    if (telegramCommunityChatId) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        userId,
      );
      if (!isMember) {
        return null;
      }
    }

    return this.mapToPublication(publication);
  }

  async createPublication(createDto: CreatePublicationDto, userId: string): Promise<Publication> {
    // Implementation for creating a new publication
    // This would involve creating a new publication in the database
    throw new Error('Publication creation not implemented yet');
  }

  async updatePublication(id: string, updateDto: Partial<CreatePublicationDto>): Promise<Publication> {
    const updateData: any = {};

    if (updateDto.content !== undefined) {
      updateData['meta.comment'] = updateDto.content;
    }
    if (updateDto.beneficiaryId !== undefined) {
      updateData['meta.beneficiary'] = {
        telegramId: updateDto.beneficiaryId,
      };
    }

    const result = await this.legacyPublicationsService.model.updateOne(
      { uid: id },
      updateData,
    );

    if (result.modifiedCount === 0) {
      throw new Error('Publication not found');
    }

    const updatedPublication = await this.legacyPublicationsService.model.findOne({ uid: id });
    return this.mapToPublication(updatedPublication);
  }

  async deletePublication(id: string): Promise<void> {
    const result = await this.legacyPublicationsService.model.deleteOne({ uid: id });

    if (result.deletedCount === 0) {
      throw new Error('Publication not found');
    }
  }

  async getCommunityPublications(
    communityId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(communityId, userId);
    if (!isMember) {
      throw new Error('Not authorized to see this community');
    }

    const publications = await this.legacyPublicationsService.getPublicationsInTgChat(
      communityId,
      pagination.limit,
      skip,
    );

    const total = await this.legacyPublicationsService.model.countDocuments({
      'meta.origin.telegramChatId': communityId,
    });

    const mappedPublications = publications.map(pub => this.mapToPublication(pub));

    return PaginationHelper.createResult(mappedPublications, total, pagination);
  }

  async getSpacePublications(
    spaceId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);

    const publications = await this.legacyPublicationsService.getPublicationsInHashtagSlug(
      spaceId,
      pagination.limit,
      skip,
    );

    // Check access to the first publication's community
    if (publications.length > 0) {
      const telegramCommunityChatId = publications[0]?.meta?.origin?.telegramChatId;
      if (telegramCommunityChatId) {
        const isMember = await this.tgBotsService.updateUserChatMembership(
          telegramCommunityChatId,
          userId,
        );
        if (!isMember) {
          throw new Error('Not authorized to see this space');
        }
      }
    }

    const total = await this.legacyPublicationsService.model.countDocuments({
      'meta.hashtagSlug': spaceId,
    });

    const mappedPublications = publications.map(pub => this.mapToPublication(pub));

    return PaginationHelper.createResult(mappedPublications, total, pagination);
  }

  async getUserPublications(userId: string, pagination: any): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);

    const publications = await this.legacyPublicationsService.getPublicationsOfAuthorTgId(
      userId,
      pagination.limit,
      skip,
    );

    const total = await this.legacyPublicationsService.model.countDocuments({
      'meta.author.telegramId': userId,
    });

    const mappedPublications = publications.map(pub => this.mapToPublication(pub));

    return PaginationHelper.createResult(mappedPublications, total, pagination);
  }

  private mapToPublication(publication: any): Publication {
    return {
      id: publication.uid,
      communityId: publication.meta?.origin?.telegramChatId || '',
      spaceId: publication.meta?.hashtagSlug,
      authorId: publication.meta?.author?.telegramId || '',
      beneficiaryId: publication.meta?.beneficiary?.telegramId,
      content: publication.meta?.comment || publication.content || '',
      type: publication.type === 'poll' ? 'poll' : 'text',
      metadata: publication.type === 'poll' ? {
        pollData: publication.content,
      } : undefined,
      metrics: {
        upthanks: publication.meta?.metrics?.plus || 0,
        downthanks: publication.meta?.metrics?.minus || 0,
        score: publication.meta?.metrics?.sum || 0,
        commentCount: 0, // Would need to count comments
        viewCount: 0, // Not tracked currently
      },
      createdAt: publication.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: publication.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
