import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { SentryInterceptor } from './common/interceptors/sentry.interceptor';

// Import the new domain module
import { DomainModule } from './domain.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`, // Environment-specific .env file
        join(process.cwd(), '../.env'),      // Root .env when running from api/ directory
        join(process.cwd(), '.env'),          // api/.env (if exists)
        join(__dirname, '../../../../.env'),  // Root .env from compiled location
        join(__dirname, '../../../.env'),     // API .env from compiled location
        '.env',                               // Current working directory .env (fallback)
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
  providers: [
    MeriterService,
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
  ],
})
export class MeriterModule {}
