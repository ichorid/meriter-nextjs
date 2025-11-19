import { Module } from '@nestjs/common';
import { PollsController } from './polls.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [PollsController],
})
export class PollsModule {}
