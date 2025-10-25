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
import { UsersService } from '../../../users/users.service';
import { successResponse } from '../utils/response.helper';


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

@Controller('api/rest/transactions')
@UseGuards(UserGuard)
export class RestTransactionsController {
  private readonly logger = new Logger(RestTransactionsController.name);

  constructor(
    private transactionsService: TransactionsService,
    private publicationsService: PublicationsService,
    private tgBotsService: TgBotsService,
    private usersService: UsersService,
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
    return successResponse(t);
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
    return successResponse(t);
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

    return successResponse(t);
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

    return successResponse(t);
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
      
      return successResponse(await this.transactionsService.createForPublication({
        amount: dto.directionPlus ? dto.amountPoints : -dto.amountPoints,
        comment: dto.comment,
        forPublicationUid: dto.forPublicationSlug,
        fromUserTgId: req.user.tgUserId,
        fromUserTgName: req.user.tgUserName,
      }));
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

      return successResponse(await this.transactionsService.createForTransaction({
        amount: dto.directionPlus ? dto.amountPoints : -dto.amountPoints,
        comment: dto.comment,
        forTransactionUid: dto.forTransactionId,
        inPublicationUid: dto.inPublicationSlug,
        fromUserTgId: req.user.tgUserId,
        fromUserTgName: req.user.tgUserName,
      }));
    }

    return successResponse({});
  }
}
