import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersService as LegacyUsersService } from '../../users/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    LegacyUsersService,
  ],
})
export class UsersModule {}
