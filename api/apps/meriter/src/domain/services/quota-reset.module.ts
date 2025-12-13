import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Community, CommunitySchema } from '../models/community/community.schema';
import { UserCommunityRole, UserCommunityRoleSchema } from '../models/user-community-role/user-community-role.schema';
import { QuotaResetService } from './quota-reset.service';
import { DomainModule } from '../../domain.module';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: UserCommunityRole.name, schema: UserCommunityRoleSchema },
    ]),
    DomainModule,
  ],
  providers: [QuotaResetService],
  exports: [QuotaResetService],
})
export class QuotaResetModule {}

