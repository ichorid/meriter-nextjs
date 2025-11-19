import { Module } from '@nestjs/common';
import { VotesController } from './votes.controller';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [DomainModule],
  controllers: [VotesController],
})
export class VotesModule {}
