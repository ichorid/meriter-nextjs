import { Module } from '@nestjs/common';
import { DomainModule } from '../../domain.module';
import { InvitesController } from './invites.controller';

@Module({
  imports: [DomainModule],
  controllers: [InvitesController],
})
export class InvitesModule {}




