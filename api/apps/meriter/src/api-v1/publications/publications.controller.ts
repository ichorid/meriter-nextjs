import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PublicationService } from '../../domain/services/publication.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreatePublicationDto } from '../../../../../../libs/shared-types/dist/index';

@Controller('api/v1/publications')
@UseGuards(UserGuard)
export class PublicationsController {
  constructor(
    private publicationService: PublicationService,
  ) {}

  @Post()
  async createPublication(
    @User() user: AuthenticatedUser,
    @Body() dto: CreatePublicationDto,
  ) {
    const publication = await this.publicationService.createPublication(user.id, dto);
    return { success: true, data: publication };
  }

  @Get(':id')
  async getPublication(@Param('id') id: string) {
    const publication = await this.publicationService.getPublication(id);
    return { success: true, data: publication };
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
