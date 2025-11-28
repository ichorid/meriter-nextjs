import { Module } from '@nestjs/common';
import { DomainModule } from '../../domain.module';
import { TeamsController } from './teams.controller';

@Module({
  imports: [DomainModule],
  controllers: [TeamsController],
})
export class TeamsModule {}




