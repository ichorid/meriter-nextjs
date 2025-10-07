import { Module } from '@nestjs/common';

import { AssetsModule } from '@common/abstracts/assets/assets.module';
import { PublicationsService } from './publications.service';

@Module({
  imports: [AssetsModule],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
