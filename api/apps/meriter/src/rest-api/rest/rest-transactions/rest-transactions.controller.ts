import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { TransactionsService } from '../../../transactions/transactions.service';
import { UserGuard } from '../../../user.guard';
import { create } from 'domain';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { PublicationsService } from '../../../publications/publications.service';

// Helper function to map transaction to old format for API backward compatibility
function mapTransactionToOldFormat(transaction: any) {
  return {
    amount: transaction.value ?? 0,
    amountFree: transaction.meta?.amounts?.amountFree ?? 0,
    amountTotal: transaction.meta?.amounts?.amountTotal ?? 0,
    comment: transaction.meta?.reason?.comment ?? '',
    currencyOfCommunityTgChatId: transaction.meta?.amounts?.currencyOfCommunityTgChatId,
    directionPlus: (transaction.value ?? 0) > 0,
    forPublicationSlug: transaction.meta?.reason?.forPublicationUid,
    fromUserTgId: transaction.meta?.from?.telegramId,
    fromUserTgName: transaction.meta?.from?.name,
    inPublicationSlug: transaction.meta?.reason?.inPublicationUid,
    forTransactionId: transaction.meta?.reason?.forTransactionUid,
    inSpaceSlug: transaction.meta?.reason?.inHashtagSlug,
    minus: transaction.meta?.metrics?.minus ?? 0,
    plus: transaction.meta?.metrics?.plus ?? 0,
    publicationClassTags: [],
    reason: transaction.type,
    sum: transaction.meta?.metrics?.sum ?? 0,
    toUserTgId: transaction.meta?.to?.telegramId,
    ts: transaction.createdAt?.toString(),
    _id: transaction._id,
  };
}

class RestTransactionsDTO {
  @IsNumber()
  amountPoints: number; //1
  
  @IsString()
  comment: string; //"Test"
  
  @IsBoolean()
  directionPlus: boolean; //true
  
  @IsOptional()
  @IsString()
  forPublicationSlug?: string; //"bWcub5MPo"
  
  @IsOptional()
  @IsString()
  forTransactionId?: string;
  
  @IsString()
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
  fromUserTgId: string; //"123456789"
  fromUserTgName: string; //"Example User"
  inPublicationSlug: string; //"rkTNLkb5n"
  forTransactionId: string;
  inSpaceSlug: string; //"bql0fbmi"
  minus: number; //0
  plus: number; //0
  publicationClassTags: [];
  reason: string; //"forPublication"
  sum: number; //0
  toUserTgId: string; //"987654321"
  ts: string; //"2021-01-08T09:40:11.179Z"

  _id: string; //"5ff8287bbb626e366c0a69a0"
}

@Controller('api/rest/transactions')
@UseGuards(UserGuard)
export class RestTransactionsController {
  private readonly logger = new Logger(RestTransactionsController.name);

  constructor(
    private transactionsService: TransactionsService,
    private publicationsService: PublicationsService,
    private tgBotsService: TgBotsService,
  ) {}

  @Get('my')
  async getMyTransactions(
    @Query('positive') positive: boolean,
    @Req() req,
  ) {
    this.logger.log('search my trans', req.user.tgUserId, positive);
    const t = await this.transactionsService.findFromUserTgId(
      req.user.tgUserId,
      positive,
    );
    this.logger.log('found comments:', t?.length);
    return { transactions: t.map(mapTransactionToOldFormat) };
  }

  @Get('updates')
  async getUpdates(
    @Query('positive') positive: boolean,
    @Req() req,
  ) {
    const t = await this.transactionsService.findToUserTgId(
      req.user.tgUserId,
      positive,
    );
    return { transactions: t.map(mapTransactionToOldFormat) };
  }

  @Get('publications/:publicationSlug')
  async getPublicationTransactions(
    @Param('publicationSlug') publicationSlug: string,
    @Query('positive') positive: boolean,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    // First, fetch the publication to get the chat ID (not from transactions!)
    const publication = await this.publicationsService.model.findOne({
      uid: publicationSlug,
    });

    if (!publication) {
      throw new HttpException(
        `Publication not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const telegramCommunityChatId = publication.meta.origin.telegramChatId;

    // Check authorization based on the publication's chat
    if (!allowedChatsIds.includes(telegramCommunityChatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember) {
        throw new HttpException(
          'not authorized to see this chat',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Only fetch transactions after authorization check passes
    const t = await this.transactionsService.findForPublication(
      publicationSlug,
      positive,
    );

    return { transactions: t.map(mapTransactionToOldFormat) };
  }

  @Get(':transactionId/replies')
  async getTransactionReplies(
    @Param('transactionId') transactionId: string,
    @Query('positive') positive: boolean,
    @Req() req,
  ) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;

    // First, fetch the parent transaction to get the chat ID
    const parentTransaction = await this.transactionsService.model.findOne({
      uid: transactionId,
    });

    if (!parentTransaction) {
      throw new HttpException(
        `Transaction not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const telegramCommunityChatId =
      parentTransaction.meta?.amounts?.currencyOfCommunityTgChatId;

    // Check authorization based on the parent transaction's chat
    if (!allowedChatsIds.includes(telegramCommunityChatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember) {
        throw new HttpException(
          'not authorized to see this chat',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Only fetch replies after authorization check passes
    const t = await this.transactionsService.findForTransaction(
      transactionId,
      positive,
    );

    return { transactions: t.map(mapTransactionToOldFormat) };
  }

  @Post()
  async rest_transactions_post(@Body() dto: RestTransactionsDTO, @Req() req) {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;
    
    if (dto.forPublicationSlug) {
      const publ = await this.publicationsService.model.findOne({
        uid: dto.forPublicationSlug,
      });
      
      if (!publ) {
        throw new HttpException('Publication not found', HttpStatus.NOT_FOUND);
      }
      
      if (!allowedChatsIds.includes(publ.meta.origin.telegramChatId)) {
        throw new HttpException('Not chat member', HttpStatus.FORBIDDEN);
      }
      
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
      
      if (!publ) {
        throw new HttpException('Publication not found', HttpStatus.NOT_FOUND);
      }
      
      if (!allowedChatsIds.includes(publ.meta.origin.telegramChatId)) {
        throw new HttpException('Not chat member', HttpStatus.FORBIDDEN);
      }

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
