import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { DocumentEventsModule } from './documents/document-events.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    DocumentEventsModule,
    UploadsModule,
  ],
})
export class ApiV1Module {}
