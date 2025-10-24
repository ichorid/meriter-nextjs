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
import { RestWithdrawDto } from './dto/rest-withdraw.dto';
import { successResponse } from '../utils/response.helper';

@Controller('api/rest/withdraw')
@UseGuards(UserGuard)
export class RestWithdrawController {
  constructor(private transactionsService: TransactionsService) {}
  @Post()
  rest_withdraw(@Body() dto: RestWithdrawDto, @Req() req) {
    if (dto.transactionId)
      return successResponse(this.transactionsService.withdrawFromTransaction({
        amount: dto.directionAdd ? -dto.amount : dto.amount,
        comment: dto.comment,
        forTransactionUid: dto.transactionId,
        userTgId: req.user.tgUserId,
        userTgName: req.user.tgUserName,
      }));

    if (dto.publicationSlug)
      return successResponse(this.transactionsService.withdrawFromPublication({
        amount: dto.directionAdd ? -dto.amount : dto.amount,
        comment: dto.comment,
        forPublicationUid: dto.publicationSlug,
        userTgId: req.user.tgUserId,
        userTgName: req.user.tgUserName,
      }));
  }
}
