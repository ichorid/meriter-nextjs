import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ThanksService } from './thanks.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Thank, CreateThankDto } from '../types/domain.types';

@Controller('api/v1')
@UseGuards(UserGuard)
export class ThanksController {
  private readonly logger = new Logger(ThanksController.name);

  constructor(private readonly thanksService: ThanksService) {}

  @Post('publications/:id/thanks')
  async thankPublication(
    @Param('id') id: string,
    @Body() createDto: CreateThankDto,
    @Req() req: any,
  ) {
    // Create thank with optional comment (atomic operation)
    const result = await this.thanksService.createThankWithComment({
      ...createDto,
      targetType: 'publication',
      targetId: id,
    }, req.user.tgUserId);
    
    return {
      data: {
        thank: result.thank,
        comment: result.comment,
        wallet: result.wallet,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Get('publications/:id/thanks')
  async getPublicationThanks(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.thanksService.getThanks(
      'publication',
      id,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }

  @Delete('publications/:id/thanks')
  async removePublicationThank(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.thanksService.removeThank('publication', id, req.user.tgUserId);
    return { success: true, data: { message: 'Thank removed successfully' } };
  }

  @Post('comments/:id/thanks')
  async thankComment(
    @Param('id') id: string,
    @Body() createDto: CreateThankDto,
    @Req() req: any,
  ) {
    // Create thank with optional comment (atomic operation)
    const result = await this.thanksService.createThankWithComment({
      ...createDto,
      targetType: 'comment',
      targetId: id,
    }, req.user.tgUserId);
    
    return {
      data: {
        thank: result.thank,
        comment: result.comment,
        wallet: result.wallet,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }

  @Get('comments/:id/thanks')
  async getCommentThanks(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.thanksService.getThanks(
      'comment',
      id,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }

  @Delete('comments/:id/thanks')
  async removeCommentThank(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    await this.thanksService.removeThank('comment', id, req.user.tgUserId);
    return { success: true, data: { message: 'Thank removed successfully' } };
  }

  @Get('thanks/:id/details')
  async getThankDetails(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const result = await this.thanksService.getThankWithComment(id, req.user.tgUserId);
    return {
      data: {
        thank: result.thank,
        comment: result.comment,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };
  }
}
