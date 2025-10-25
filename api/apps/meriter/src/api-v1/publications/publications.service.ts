import { Injectable, Logger } from '@nestjs/common';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Publication, CreatePublicationDto } from '../types/domain.types';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private readonly publicationServiceV2: PublicationServiceV2,
    private readonly tgBotsService: TgBotsService,
  ) {}

  async getPublications(pagination: any, filters: any): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // For now, return empty results since we need to implement proper filtering
    // This would need to be implemented in PublicationServiceV2
    const publications: Publication[] = [];
    
    return PaginationHelper.createResult(publications, 0, pagination);
  }

  async getPublication(id: string, userId: string): Promise<Publication | null> {
    const publication = await this.publicationServiceV2.getPublication(id);
    if (!publication) {
      return null;
    }

    // Check if user has access to this publication
    const communityId = publication.getCommunityId.getValue();
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    return this.mapToPublication(publication);
  }

  async createPublication(createDto: CreatePublicationDto, userId: string): Promise<Publication> {
    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      createDto.communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // Create publication using V2 service
    const publication = await this.publicationServiceV2.createPublication(userId, createDto);
    return this.mapToPublication(publication);
  }

  async updatePublication(id: string, updateDto: Partial<CreatePublicationDto>, userId: string): Promise<Publication> {
    const publication = await this.publicationServiceV2.updatePublication(id, userId, updateDto);
    return this.mapToPublication(publication);
  }

  async deletePublication(id: string, userId: string): Promise<boolean> {
    return await this.publicationServiceV2.deletePublication(id, userId);
  }

  async getCommunityPublications(
    communityId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // This would need to be implemented in PublicationServiceV2
    const publications: Publication[] = [];
    
    return PaginationHelper.createResult(publications, 0, pagination);
  }

  async getUserPublications(
    userId: string,
    pagination: any,
    requestingUserId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const publications = await this.publicationServiceV2.getPublicationsByAuthor(
      userId,
      pagination.limit,
      skip
    );

    const mappedPublications = publications.map(publication => this.mapToPublication(publication));

    return PaginationHelper.createResult(mappedPublications, mappedPublications.length, pagination);
  }

  async getSpacePublications(
    spaceId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // This would need to be implemented in PublicationServiceV2
    const publications: Publication[] = [];
    
    return PaginationHelper.createResult(publications, 0, pagination);
  }

  async getHashtagPublications(
    hashtag: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Publication>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const publications = await this.publicationServiceV2.getPublicationsByHashtag(
      hashtag,
      pagination.limit,
      skip
    );

    const mappedPublications = publications.map(publication => this.mapToPublication(publication));

    return PaginationHelper.createResult(mappedPublications, mappedPublications.length, pagination);
  }

  private mapToPublication(publication: any): Publication {
    return {
      id: publication.getId?.getValue() || publication.id,
      communityId: publication.getCommunityId?.getValue() || publication.communityId,
      spaceId: publication.getSpaceId?.() || publication.spaceId,
      authorId: publication.getAuthorId?.getValue() || publication.authorId,
      beneficiaryId: publication.getBeneficiaryId?.() || publication.beneficiaryId,
      content: publication.getContent?.() || publication.content,
      type: publication.getType?.() || publication.type,
      hashtags: publication.getHashtags?.() || publication.hashtags || [],
      imageUrl: publication.getImageUrl?.() || publication.imageUrl,
      videoUrl: publication.getVideoUrl?.() || publication.videoUrl,
      metadata: publication.getMetadata?.() || publication.metadata,
      metrics: {
        upvotes: publication.getMetrics?.().upvotes || publication.metrics?.upvotes || 0,
        downvotes: publication.getMetrics?.().downvotes || publication.metrics?.downvotes || 0,
        upthanks: publication.getMetrics?.().upthanks || publication.metrics?.upthanks || 0,
        downthanks: publication.getMetrics?.().downthanks || publication.metrics?.downthanks || 0,
        score: publication.getMetrics?.().score || publication.metrics?.score || 0,
        commentCount: publication.getMetrics?.().commentCount || publication.metrics?.commentCount || 0,
        viewCount: publication.getMetrics?.().viewCount || publication.metrics?.viewCount || 0,
      },
      createdAt: publication.getCreatedAt?.()?.toISOString() || publication.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: publication.getUpdatedAt?.()?.toISOString() || publication.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}