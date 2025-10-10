import { Module } from '@nestjs/common';
import { TgSyncService } from './tg-sync.service';

@Module({
  providers: [TgSyncService],
  exports: [TgSyncService],
})
export class TgSyncModule {}
