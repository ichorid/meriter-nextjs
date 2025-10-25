import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PublicationsService } from '../../../publications/publications.service';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { successResponse } from '../utils/response.helper';


@Controller('api/rest/publications')
@UseGuards(UserGuard)
export class RestPublicationsController {
  constructor(
    private publicationService: PublicationsService,
    private tgBotsService: TgBotsService,
  ) {}

  @Get('my')
  async getMyPublications(
    @Query('positive') positive: boolean,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req,
  ) {
    const tgUserId = req.user.tgUserId;
    const publ = await this.publicationService.getPublicationsOfAuthorTgId(
      tgUserId,
      limit,
      skip,
      positive,
    );
    return successResponse(publ);
  }

  @Get('communities/:chatId')
  async getCommunityPublications(
    @Param('chatId') chatId: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    if (!allowedChatsIds.includes(chatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        chatId,
        tgUserId,
      );
      if (!isMember)
        throw new HttpException(
          'not authorized to see this chat',
          HttpStatus.FORBIDDEN,
        );
    }

    const publ = await this.publicationService.getPublicationsInTgChat(
      chatId,
      limit,
      skip,
    );
    
    return successResponse({
      publications: publ,
    });
  }

  @Get('spaces/:slug/:publicationSlug')
  async getSpacePublication(
    @Param('slug') slug: string,
    @Param('publicationSlug') publicationSlug: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    const publ = await this.publicationService.model.findOne({
      uid: publicationSlug,
    });

    if (!publ) {
      throw new HttpException(
        `Publication with slug '${publicationSlug}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const telegramCommunityChatId = publ.meta.origin.telegramChatId;
    if (!allowedChatsIds.includes(telegramCommunityChatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember)
        throw new HttpException(
          'not authorized to see this chat',
          HttpStatus.FORBIDDEN,
        );
    }

    if (skip > 0) return successResponse({ publications: [] });
    return successResponse({
      publications: [publ],
      publicationSlug,
    });
  }

  @Get('spaces/:slug')
  async getSpacePublications(
    @Param('slug') slug: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    const publ = await this.publicationService.getPublicationsInHashtagSlug(
      slug,
      limit,
      skip,
    );

    const telegramCommunityChatId = publ?.[0]?.meta?.origin?.telegramChatId;
    if (
      telegramCommunityChatId &&
      !allowedChatsIds.includes(telegramCommunityChatId)
    ) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember)
        throw new HttpException(
          'not authorized to see this chat',
          HttpStatus.FORBIDDEN,
        );
    }

    return successResponse({
      publications: publ,
    });
  }

  // This route must be last as it's a catch-all pattern
  @Get(':slug')
  async getPublication(
    @Param('slug') slug: string,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    const publ = await this.publicationService.model.findOne({
      uid: slug,
    });

    if (!publ) {
      throw new HttpException(
        `Publication with slug '${slug}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const telegramCommunityChatId = publ.meta.origin.telegramChatId;
    if (!allowedChatsIds.includes(telegramCommunityChatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember)
        throw new HttpException(
          'not authorized to see this publication',
          HttpStatus.FORBIDDEN,
        );
    }

    return successResponse(publ);
  }
}
