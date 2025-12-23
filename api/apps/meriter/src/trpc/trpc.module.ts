import { Module } from '@nestjs/common';
import { TrpcController } from './trpc.controller';
import { TrpcService } from './trpc.service';
import { DomainModule } from '../domain.module';
import { ApiV1CommonModule } from '../api-v1/common/common.module';
import { AuthModule } from '../api-v1/auth/auth.module';
import { QuotaResetModule } from '../domain/services/quota-reset.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule, AuthModule, QuotaResetModule],
  controllers: [TrpcController],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}

