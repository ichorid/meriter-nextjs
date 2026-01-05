import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    UploadsModule,
  ],
})
export class ApiV1Module {}
