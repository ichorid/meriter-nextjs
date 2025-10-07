import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { ActorsModule } from '@common/abstracts/actors/actors.module';

@Module({
  imports: [ActorsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
