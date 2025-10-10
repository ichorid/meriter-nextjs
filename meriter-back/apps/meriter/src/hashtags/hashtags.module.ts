import { Module } from '@nestjs/common';
import { ActorsModule } from '@common/abstracts/actors/actors.module';
import { HashtagsService } from './hashtags.service';

@Module({
  imports: [ActorsModule],
  providers: [HashtagsService],
  exports: [HashtagsService],
})
export class HashtagsModule {}
