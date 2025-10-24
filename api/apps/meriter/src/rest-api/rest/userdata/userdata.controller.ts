import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from '../../../users/users.service';
import { successResponse } from '../utils/response.helper';

class UserdataResponse {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  photoUrl?: string;
}

@Controller('api/rest/users')
export class RestUserdataController {
  constructor(private readonly usersService: UsersService) {}

  @Get('telegram/:telegramUserId/profile')
  async getUserProfile(@Param('telegramUserId') telegramUserId: string) {
    const profile = await this.usersService.getProfileByTelegramId(
      telegramUserId,
    );

    if (!profile) {
      return successResponse({ userdata: null });
    }

    const userdata: UserdataResponse = {
      firstName: profile.name?.split(' ')[0],
      lastName: profile.name?.split(' ').slice(1).join(' '),
      avatarUrl: profile.avatarUrl,
      photoUrl: profile.avatarUrl, // Using avatarUrl for photoUrl as well
    };

    return successResponse({ userdata });
  }
}
