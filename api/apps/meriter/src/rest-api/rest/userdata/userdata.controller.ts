import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from '../../../users/users.service';

class UserdataResponse {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  photoUrl?: string;
}

@Controller('api/userdata')
export class RestUserdataController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async rest_userdata(
    @Query('action') action: string,
    @Query('telegramUserId') telegramUserId: string,
  ) {
    if (action === 'userdataGetByTelegramId') {
      const profile = await this.usersService.getProfileByTelegramId(
        telegramUserId,
      );
      
      if (!profile) {
        return { userdata: null };
      }

      const userdata: UserdataResponse = {
        firstName: profile.name?.split(' ')[0],
        lastName: profile.name?.split(' ').slice(1).join(' '),
        avatarUrl: profile.avatarUrl,
        photoUrl: profile.avatarUrl, // Using avatarUrl for photoUrl as well
      };

      return { userdata };
    }

    return { noaction: true };
  }
}
