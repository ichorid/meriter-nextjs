import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UpdatesConductorsService } from '../../../updates-conductors/updates-conductors.service';
import { UserGuard } from '../../../user.guard';
import { successResponse } from '../utils/response.helper';

@Controller('api/rest/freq')
@UseGuards(UserGuard)
export class RestFreqController {
  constructor(private updatesConductorsService: UpdatesConductorsService) {}

  @Get()
  rest_getfrequency(@Req() req) {
    return successResponse(this.updatesConductorsService.getFrequency(
      'actor.user://telegram' + req.user.tgUserId,
    ));
  }

  @Post()
  rest_setfrequency(
    @Req() req,
    @Body('updateFrequencyMs') updateFrequencyMs: number,
  ) {
    if (!updateFrequencyMs) throw 'no frequency given';
    if (!req.user?.tgUserId) throw 'no user given to update freq';
    return successResponse(this.updatesConductorsService.setFrequency(
      'actor.user://telegram' + req.user.tgUserId,
      updateFrequencyMs,
    ));
  }
}
