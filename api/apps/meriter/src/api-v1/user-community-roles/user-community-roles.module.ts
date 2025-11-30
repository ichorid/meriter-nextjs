import { Module } from '@nestjs/common';
import { DomainModule } from '../../domain.module';
import { UserCommunityRolesController } from './user-community-roles.controller';

@Module({
  imports: [DomainModule],
  controllers: [UserCommunityRolesController],
})
export class UserCommunityRolesModule {}







