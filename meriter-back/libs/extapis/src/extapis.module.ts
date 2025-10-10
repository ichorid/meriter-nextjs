import { Module } from '@nestjs/common';
import { ExtapisService } from './extapis.service';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  providers: [ExtapisService],
  exports: [ExtapisService],
  imports: [TelegramModule],
})
export class ExtapisModule {}
