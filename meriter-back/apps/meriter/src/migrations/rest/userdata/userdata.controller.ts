import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from '../../../users/users.service';

class RestUserdataResponse {
  avatarUrl: string; //"https://telegram.hb.bizmrg.com/telegram_small_avatars/415615274.jpg"
  firstName: string; //"Yulia"
  lastName: string; //"Nikitina"
}

@Controller('api/rest/userdata')
export class RestUserdataController {
  constructor(private usersService: UsersService) {}
  @Get()
  async rest_userdata(
    @Query('action') action: string,
    @Query('telegramUserId') telegramUserId: string,
  ) {
    const profile = await this.usersService.getProfileByTelegramId(
      telegramUserId,
    );
    //   console.log('profile', telegramUserId, profile);
    if (profile?.name)
      return {
        firstName: profile.name.split(' ')?.[0],
        lastName: profile.name.split(' ')?.[1],
        avatarUrl: profile.avatarUrl,
      };
    else return {};
  }
}
