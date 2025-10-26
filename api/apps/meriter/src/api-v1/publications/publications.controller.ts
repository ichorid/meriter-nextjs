import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('api/v1/publications')
@UseGuards(UserGuard)
export class PublicationsController {
  constructor(
    private publicationService: PublicationServiceV2, // Use V2 service
  ) {}

  @Post()
  async createPublication(
    @User() user: AuthenticatedUser,
    @Body() dto: {
      communityId: string;
      content: string;
      type: 'text' | 'image' | 'video';
      beneficiaryId?: string;
      hashtags?: string[];
      imageUrl?: string;
      videoUrl?: string;
    },
  ) {
    return this.publicationService.createPublication(user.id, dto);
  }

  @Get(':id')
  async getPublication(@Param('id') id: string) {
    return this.publicationService.getPublication(id);
  }

  @Get()
  async getPublications(
    @Query('communityId') communityId?: string,
    @Query('authorId') authorId?: string,
    @Query('hashtag') hashtag?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    if (communityId) {
      return this.publicationService.getPublicationsByCommunity(communityId, parsedLimit, parsedSkip);
    }
    
    if (authorId) {
      return this.publicationService.getPublicationsByAuthor(authorId, parsedLimit, parsedSkip);
    }

    if (hashtag) {
      return this.publicationService.getPublicationsByHashtag(hashtag, parsedLimit, parsedSkip);
    }

    return this.publicationService.getTopPublications(parsedLimit, parsedSkip);
  }

  @Put(':id')
  async updatePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updates: Partial<{
      content: string;
      hashtags: string[];
    }>,
  ) {
    return this.publicationService.updatePublication(id, user.id, updates);
  }

  @Delete(':id')
  async deletePublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.publicationService.deletePublication(id, user.id);
    return { success: true };
  }

  @Post(':id/vote')
  async voteOnPublication(
    @User() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: { amount: number; direction: 'up' | 'down' },
  ) {
    return this.publicationService.voteOnPublication(id, user.id, dto.amount, dto.direction);
  }
}
