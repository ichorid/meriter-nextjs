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
import { Publication } from '../../../publications/model/publication.model';
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
  authorPhotoUrl: string; //"https://example.com/telegram_avatars/987654321.jpg"
  classTags: string[]; //[]
  fromCommunity: boolean; //false
  fromTgChatId: string; //"-400774319"
  keyword: string; //"намерение"
  messageText: string; //"#намерение раздватри"
  minus: number; //13
  pending: boolean; //false
  plus: number; //23
  slug: string; //"rkTNLkb5n"
  spaceSlug: string; //"bql0fbmi"
  sum: number; //10
  tgAuthorId: string; //"987654321"
  tgAuthorName: string; //"Example User"
  tgChatId: string; //"-400774319"
  tgChatName: string; //"MERITER CORP ТЕСТИРОВАНИЕ"
  tgMessageId: string; //"35"
  ts: string; //"2021-01-08T09:35:42.998Z"
  _id: string; //"5ff8276ebb626e366c0a696c"
}
export class RestPublicationsinfResponse {
  publications: RestPublicationObject[];
}

@Controller('api/rest/publicationsinf')
@UseGuards(UserGuard)
export class PublicationsinfController {
  constructor(
    private publicationService: PublicationsService,
    private tgBotsService: TgBotsService,
  ) {}

  @Get()
  async publicationsinf(
    @Query('path') path: string, // /c/-400774319   /bql0fbmi
    @Query('my') my: string, // /c/-400774319   /bql0fbmi
    @Query('positive') positive: boolean, // /c/-400774319   /bql0fbmi
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;
    if (my != undefined) {
      const publ = await this.publicationService.getPublicationsOfAuthorTgId(
        tgUserId,
        limit,
        skip,
        positive,
      );
      return {
        publications: publ.map((p) => mapPublicationToOldFormat(p)),
      };
    } else if (path.match('/c/')) {
      const telegramCommunityChatId = path.replace('/c/', '');

      const publ = await this.publicationService.getPublicationsInTgChat(
        telegramCommunityChatId,
        limit,
        skip,
      );
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
      return {
        publications: publ.map((p) => mapPublicationToOldFormat(p)),
      };
      //
    } else if (path.replace('/', '').match('/')) {
      const publicationSlug = path.split('/')?.[2];

      const publ = await this.publicationService.model.findOne({
        uid: publicationSlug,
      });
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
    } else {
      const spaceSlug = path.replace('/', '');
      const publ = await this.publicationService.getPublicationsInHashtagSlug(
        spaceSlug,
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

    return new RestPublicationsinfResponse();
  }
}
