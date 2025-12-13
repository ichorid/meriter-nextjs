import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

import { join } from 'path';

import { ApiV1Module } from './api-v1/api-v1.module';
import { DatabaseModule } from './common/database/database.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

import { UpdatesConductorsService } from './updates-conductors/updates-conductors.service';
import { UpdatesConductorsModule } from './updates-conductors/updates-conductors.module';
import { QuotaResetModule } from './domain/services/quota-reset.module';

// Import the new domain module
import { DomainModule } from './domain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseModule,
    ApiV1Module,
    DomainModule, // Domain layer with domain services
    UpdatesConductorsModule,
    QuotaResetModule,
  ],
  controllers: [MeriterController],
  providers: [MeriterService],
})
export class MeriterModule {}
