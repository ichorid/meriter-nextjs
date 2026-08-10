import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PostClosingCronService } from './post-closing-cron.service';
import { DomainModule } from '../../domain.module';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PersistenceModule,
    DomainModule,
  ],
  providers: [PostClosingCronService],
  exports: [PostClosingCronService],
})
export class PostClosingCronModule {}
