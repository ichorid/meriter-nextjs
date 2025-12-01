import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DomainModule } from '../../domain.module';
import { InvitesController } from './invites.controller';
import { User, UserSchema } from '../../domain/models/user/user.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [InvitesController],
})
export class InvitesModule {}








