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
import { mapPublicationToOldPublication } from '../../schemas/old-publication.schema';
import { Publication } from '../../../publications/model/publication.model';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';

class RestPublicationObject {
  authorPhotoUrl: string; //"https://telegram.hb.bizmrg.com/telegram_small_avatars/853551.jpg"
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
  tgAuthorId: string; //"853551"
  tgAuthorName: string; //"Nick Erlan"
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
        publications: publ.map((p) => mapPublicationToOldPublication(p)),
      };
    } else if (path.match('/c/')) {
      const telegramCommunityChatId = path.replace('/c/', '');

      const publ = await this.publicationService.getPublicationsInTgChat(
        telegramCommunityChatId,
        limit,
        skip,
      );
      let setJwt;
      if (!allowedChatsIds.includes(telegramCommunityChatId)) {
        setJwt = await this.tgBotsService.updateCredentialsForChatId(
          telegramCommunityChatId,
          tgUserId,
          'fullPath:///mt' + path,
        );
        if (!setJwt)
          throw new HttpException(
            'not authorized to see this chat',
            HttpStatus.FORBIDDEN,
          );
      }
      return {
        publications: publ.map((p) => mapPublicationToOldPublication(p)),
        setJwt,
      };
      //
    } else if (path.replace('/', '').match('/')) {
      const publicationSlug = path.split('/')?.[2];

      const publ = await this.publicationService.model.findOne({
        uid: publicationSlug,
      });
      const telegramCommunityChatId = publ.meta.origin.telegramChatId;
      let setJwt;
      if (!allowedChatsIds.includes(telegramCommunityChatId)) {
        setJwt = await this.tgBotsService.updateCredentialsForChatId(
          telegramCommunityChatId,
          tgUserId,
        );
        if (!setJwt)
          throw new HttpException(
            'not authorized to see this chat',
            HttpStatus.FORBIDDEN,
          );
      }
      if (skip > 0) return { publications: [] };
      return {
        publications: [mapPublicationToOldPublication(publ)],
        publicationSlug,
        setJwt,
      };
    } else {
      const spaceSlug = path.replace('/', '');
      const publ = await this.publicationService.getPublicationsInHashtagSlug(
        spaceSlug,
        limit,
        skip,
      );
      const telegramCommunityChatId = publ?.[0]?.meta?.origin?.telegramChatId;
      let setJwt;
      if (
        telegramCommunityChatId &&
        !allowedChatsIds.includes(telegramCommunityChatId)
      ) {
        setJwt = await this.tgBotsService.updateCredentialsForChatId(
          telegramCommunityChatId,
          tgUserId,
        );
        if (!setJwt)
          throw new HttpException(
            'not authorized to see this chat',
            HttpStatus.FORBIDDEN,
          );
      }
      return {
        publications: publ.map((p) => mapPublicationToOldPublication(p)),
      };
    }

    return new RestPublicationsinfResponse();
  }
}
