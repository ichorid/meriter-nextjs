import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserGuard } from '../../../user.guard';
import { TransactionsService } from '../../../transactions/transactions.service';

class RestWithdrawDTO {
  amount: number; //1;
  amountInternal: number; //1;
  comment: string; //'Пробное снятие';
  directionAdd: boolean; //false;
  publicationSlug?: string; //'gLGaM3047';
  transactionId?: string; //'gLGaM3047';
  withdrawMerits: boolean; //false;
}

@Controller('api/rest/withdraw')
@UseGuards(UserGuard)
export class RestWithdrawController {
  constructor(private transactionsService: TransactionsService) {}
  @Post()
  rest_withdraw(@Body() dto: RestWithdrawDTO, @Req() req) {
    if (dto.transactionId)
      return this.transactionsService.withdrawFromTransaction({
        amount: dto.directionAdd ? -dto.amount : dto.amount,
        comment: dto.comment,
        forTransactionUid: dto.transactionId,
        userTgId: req.user.tgUserId,
        userTgName: req.user.tgUserName,
      });

    if (dto.publicationSlug)
      return this.transactionsService.withdrawFromPublication({
        amount: dto.directionAdd ? -dto.amount : dto.amount,
        comment: dto.comment,
        forPublicationUid: dto.publicationSlug,
        userTgId: req.user.tgUserId,
        userTgName: req.user.tgUserName,
      });
  }
}
