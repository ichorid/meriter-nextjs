import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DomainModule } from '../domain.module';
import { ApiV1CommonModule } from '../api-v1/common/common.module';
import { AuthModule } from '../api-v1/auth/auth.module';
import { QuotaResetModule } from '../domain/services/quota-reset.module';
import { UploadsModule } from '../api-v1/uploads/uploads.module';
import { CommonServicesModule } from '../common/services/common-services.module';

@Module({
  imports: [
    DomainModule,
    ApiV1CommonModule,
    AuthModule,
    QuotaResetModule,
    UploadsModule,
    CommonServicesModule, // Provides AuthenticationService
  ],
  // TrpcController removed - tRPC is handled via Express middleware in main.ts
  // to properly support batch requests with comma-separated paths
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}

