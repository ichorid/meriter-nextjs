import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

import { join } from 'path';

import { ApiV1Module } from './api-v1/api-v1.module';
import { DatabaseModule } from './common/database/database.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

import { UpdatesConductorsModule } from './updates-conductors/updates-conductors.module';
import { QuotaResetModule } from './domain/services/quota-reset.module';
import { CommonServicesModule } from './common/services/common-services.module';
import { TgBotsModule } from './tg-bots/tg-bots.module';

// Import the new domain module
import { DomainModule } from './domain.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'), // Root .env file (when running from root)
        join(__dirname, '../../../../.env'), // Root .env from compiled location
        join(__dirname, '../../../.env'), // API .env file (if exists)
        '.env', // Current working directory .env (fallback)
      ],
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseModule,
    CommonServicesModule, // Feature flags and common services
    ApiV1Module,
    DomainModule, // Domain layer with domain services
    UpdatesConductorsModule,
    QuotaResetModule,
    // TgBotsModule is always registered, but TgBotsService checks TELEGRAM_BOT_ENABLED flag internally
    // This allows the module to be available but the service methods will return early if disabled
    TgBotsModule,
    TrpcModule, // tRPC for type-safe API
  ],
  controllers: [MeriterController],
  providers: [MeriterService],
})
export class MeriterModule {}
