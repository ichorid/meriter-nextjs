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

// Helper function to map publication to old format for API backward compatibility
function mapPublicationToOldFormat(publication: any) {
  return {
    authorPhotoUrl: publication.meta?.author?.photoUrl,
    canceled: false,
    fromCommunity: false,
    fromTgChatId: publication.meta?.origin?.telegramChatId,
    keyword: publication.meta?.hashtagName,
    messageText: publication.meta?.comment,
    entities: publication.meta?.commentTgEntities,
    minus: publication.meta?.metrics?.minus ?? 0,
    pending: false,
    plus: publication.meta?.metrics?.plus ?? 0,
    slug: publication.uid,
    spaceSlug: publication.meta?.hashtagSlug,
    sum: publication.meta?.metrics?.sum ?? 0,
    tgAuthorId: publication.meta?.author?.telegramId,
    tgAuthorName: publication.meta?.author?.name,
    tgAuthorUsername: publication.meta?.author?.username,
    beneficiaryName: publication.meta?.beneficiary?.name,
    beneficiaryPhotoUrl: publication.meta?.beneficiary?.photoUrl,
    beneficiaryId: publication.meta?.beneficiary?.telegramId,
    beneficiaryUsername: publication.meta?.beneficiary?.username,
    tgChatId: publication.meta?.origin?.telegramChatId,
    tgChatName: publication.meta?.origin?.telegramChatName,
    tgChatUsername: '',
    tgMessageId: publication.meta?.origin?.messageId,
    ts: publication.createdAt?.toString(),
    _id: publication.uid,
    type: (publication as any).type,
    content: (publication as any).content,
  };
}

class RestPublicationObject {
  authorPhotoUrl: string;
  classTags: string[];
  fromCommunity: boolean;
  fromTgChatId: string;
  keyword: string;
  messageText: string;
  minus: number;
  pending: boolean;
  plus: number;
  slug: string;
  spaceSlug: string;
  sum: number;
  tgAuthorId: string;
  tgAuthorName: string;
  tgChatId: string;
  tgChatName: string;
  tgMessageId: string;
  ts: string;
  _id: string;
}

export class RestPublicationsinfResponse {
  publications: RestPublicationObject[];
}

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
    return {
      publications: publ.map((p) => mapPublicationToOldFormat(p)),
    };
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
    
    return {
      publications: publ.map((p) => mapPublicationToOldFormat(p)),
    };
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

    if (skip > 0) return { publications: [] };
    return {
      publications: [mapPublicationToOldFormat(publ)],
      publicationSlug,
    };
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

    return {
      publications: publ.map((p) => mapPublicationToOldFormat(p)),
    };
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

    return mapPublicationToOldFormat(publ);
  }
}
