import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { DomainModule } from '../../domain.module';
import { ApiV1CommonModule } from '../common/common.module';
import { InfrastructureUploadsModule } from '../../infrastructure/uploads/infrastructure-uploads.module';
@Module({
  imports: [DomainModule, ApiV1CommonModule, InfrastructureUploadsModule],
  controllers: [UploadsController],
  exports: [InfrastructureUploadsModule],
})
export class UploadsModule {}
