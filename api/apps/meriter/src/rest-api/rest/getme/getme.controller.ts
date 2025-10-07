import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UserGuard } from '../../../user.guard';
class RestGetme {
  chatsIds: string; //["-489662780", "-412098328", "-330450739", "-409959929", "-1001358026478", "-1001162632625"]
  //iat: number; // 1617380840
  name: string; //"Yulia Nikitina"
  tgUserId: string; //"415615274"
  token: string; //"fjze77h5evbiex281vyjh1da7tvkx17o"
}
@Controller('api/rest/getme')
@UseGuards(UserGuard)
export class RestGetmeController {
  @Get()
  rest_getme(@Req() req): RestGetme {
    return {
      chatsIds: req.user?.chatsIds,
      name: req.user?.profile?.name,
      tgUserId: req.user?.identities?.[0]?.replace('telegram://', ''),
      token: req.user?.token,
    };
  }
}
