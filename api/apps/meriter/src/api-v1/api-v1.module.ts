import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    AuthModule,
    UploadsModule,
  ],
})
export class ApiV1Module {}
