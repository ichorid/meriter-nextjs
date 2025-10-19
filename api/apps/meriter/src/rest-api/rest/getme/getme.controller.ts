import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserGuard } from '../../../user.guard';
import { RestGetmeDto } from './dto/rest-getme.dto';

@Controller('api/rest/getme')
@UseGuards(UserGuard)
export class RestGetmeController {
  @Get()
  rest_getme(@Req() req): RestGetmeDto {
    return {
      chatsIds: req.user?.chatsIds,
      name: req.user?.profile?.name,
      tgUserId: req.user?.identities?.[0]?.replace('telegram://', ''),
      token: req.user?.token,
      avatarUrl: req.user?.profile?.avatarUrl,
    };
  }
}
