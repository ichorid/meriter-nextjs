import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}

