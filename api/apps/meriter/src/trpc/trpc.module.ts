import { Module } from '@nestjs/common';
import { TrpcController } from './trpc.controller';
import { TrpcService } from './trpc.service';
import { DomainModule } from '../domain.module';
import { ApiV1CommonModule } from '../api-v1/common/common.module';

@Module({
  imports: [DomainModule, ApiV1CommonModule],
  controllers: [TrpcController],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}

