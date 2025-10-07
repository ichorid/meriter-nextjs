import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from '../../../transactions/transactions.service';
import { mapTransactionToOldTransaction } from '../../schemas/old-transaction.schema';
import { UserGuard } from '../../../user.guard';
import { create } from 'domain';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { PublicationsService } from '../../../publications/publications.service';

class RestTransactionsDTO {
  amountPoints: number; //1
  comment: string; //"Test"
  directionPlus: boolean; //true
  forPublicationSlug?: string; //"bWcub5MPo"
  forTransactionId?: string;
  inPublicationSlug: string; //"bWcub5MPo"
}
class RestTransactionsResponse {
  transactions: RestTransactionObject[];
}
class RestTransactionObject {
  amount: number; //0
  amountFree: number; //3
  amountTotal: number; //3
  comment: string; //"Три голоса плюс"
  currencyOfCommunityTgChatId: string; //"-400774319"
  directionPlus: boolean; //true
  forPublicationSlug: string; //"rkTNLkb5n"
  fromUserTgId: string; //"415615274"
  fromUserTgName: string; //"Yulia Nikitina"
  inPublicationSlug: string; //"rkTNLkb5n"
  forTransactionId: string;
  inSpaceSlug: string; //"bql0fbmi"
  minus: number; //0
  plus: number; //0
  publicationClassTags: [];
  reason: string; //"forPublication"
  sum: number; //0
  toUserTgId: string; //"853551"
  ts: string; //"2021-01-08T09:40:11.179Z"

  _id: string; //"5ff8287bbb626e366c0a69a0"
}

@Controller('api/rest/transaction')
@UseGuards(UserGuard)
export class RestTransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    private publicationsService: PublicationsService,
    private tgBotsService: TgBotsService,
  ) {}
  @Get()
  async rest_transactions(
    @Query('forPublicationSlug') forPublicationSlug: string,
    @Query('forTransactionId') forTransactionId: string,
    @Query('my') my: string,
    @Query('updates') updates: boolean,
    @Query('positive') positive: boolean,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    if (forPublicationSlug) {
      const t = await this.transactionsService.findForPublication(
        forPublicationSlug,
        positive,
      );

      const telegramCommunityChatId =
        t?.[0]?.meta?.amounts?.currencyOfCommunityTgChatId;

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

      return { transactions: t.map(mapTransactionToOldTransaction), setJwt };
    }
    if (forTransactionId) {
      const t = await this.transactionsService.findForTransaction(
        forTransactionId,
        positive,
      );

      const telegramCommunityChatId =
        t?.[0]?.meta?.amounts?.currencyOfCommunityTgChatId;

      //console.log('t[0]', t?.[0]);
      //console.log('telegramCommunityChatId', telegramCommunityChatId);

      let setJwt;
      if (t.length > 0 && !allowedChatsIds.includes(telegramCommunityChatId)) {
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
      return { transactions: t.map(mapTransactionToOldTransaction), setJwt };
    }
    if (updates !== undefined) {
      const t = await this.transactionsService.findToUserTgId(
        req.user.tgUserId,
        positive,
      );
      return { transactions: t.map(mapTransactionToOldTransaction) };
    }
    if (my !== undefined) {
      console.log('search my trans', req.user.tgUserId, positive);
      const t = await this.transactionsService.findFromUserTgId(
        req.user.tgUserId,
        positive,
      );
      console.log('found comments:',t?.length)
      return { transactions: t.map(mapTransactionToOldTransaction) };
    }
    return new RestTransactionsResponse();
  }

  @Post()
  async rest_transactions_post(@Body() dto: RestTransactionsDTO, @Req() req) {
    //console.log(dto);

    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;
    if (dto.forPublicationSlug) {
      const publ = await this.publicationsService.model.findOne({
        uid: dto.forPublicationSlug,
      });
      publ.meta.origin.telegramChatId;
      if (!allowedChatsIds.includes(publ.meta.origin.telegramChatId))
        throw 'not chat member';
      return await this.transactionsService.createForPublication({
        amount: dto.directionPlus ? dto.amountPoints : -dto.amountPoints,
        comment: dto.comment,
        forPublicationUid: dto.forPublicationSlug,
        fromUserTgId: req.user.tgUserId,
        fromUserTgName: req.user.tgUserName,
      });
    }

    if (dto.forTransactionId) {
      const publ = await this.publicationsService.model.findOne({
        uid: dto.inPublicationSlug,
      });
      if (!allowedChatsIds.includes(publ.meta.origin.telegramChatId))
        throw 'not chat member';

      return await this.transactionsService.createForTransaction({
        amount: dto.directionPlus ? dto.amountPoints : -dto.amountPoints,
        comment: dto.comment,
        forTransactionUid: dto.forTransactionId,
        inPublicationUid: dto.inPublicationSlug,
        fromUserTgId: req.user.tgUserId,
        fromUserTgName: req.user.tgUserName,
      });
    }

    return {};
  }
}
