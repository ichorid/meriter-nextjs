import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [UsersController],
})
export class UsersModule {}
