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
  async rest_getfrequency(@Req() req) {
    console.log('GET /api/rest/freq - Request received');
    console.log('User:', req.user);
    
    const actorUri = 'actor.user://telegram' + req.user.tgUserId;
    console.log('Actor URI:', actorUri);
    
    const frequency = await this.updatesConductorsService.getFrequency(actorUri);
    console.log('Frequency result:', frequency);
    
    return successResponse(frequency);
  }

  @Post()
  async rest_setfrequency(
    @Req() req,
    @Body('updateFrequencyMs') updateFrequencyMs: number,
  ) {
    console.log('POST /api/rest/freq - Request received');
    console.log('User:', req.user);
    console.log('updateFrequencyMs:', updateFrequencyMs);
    
    if (!updateFrequencyMs) throw 'no frequency given';
    if (!req.user?.tgUserId) throw 'no user given to update freq';
    
    const actorUri = 'actor.user://telegram' + req.user.tgUserId;
    console.log('Actor URI:', actorUri);
    
    const result = await this.updatesConductorsService.setFrequency(
      actorUri,
      updateFrequencyMs,
    );
    
    console.log('Set frequency result:', result);
    return successResponse(result);
  }
}
