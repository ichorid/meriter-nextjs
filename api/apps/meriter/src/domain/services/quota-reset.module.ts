import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CommunitySchemaClass, CommunitySchema } from '../models/community/community.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleSchema } from '../models/user-community-role/user-community-role.schema';
import { QuotaResetService } from './quota-reset.service';
import { DomainModule } from '../../domain.module';
import { DatabaseModule } from '../../common/database/database.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: CommunitySchemaClass.name, schema: CommunitySchema },
      { name: UserCommunityRoleSchemaClass.name, schema: UserCommunityRoleSchema },
    ]),
    DomainModule,
  ],
  providers: [QuotaResetService],
  exports: [QuotaResetService],
})
export class QuotaResetModule {}

