import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig>) => ({
        uri: ((configService.get as any)('database.mongoUrl') ?? 'mongodb://127.0.0.1:27017/meriter') as string,
        // Add connection timeout options to prevent hanging
        serverSelectionTimeoutMS: 10000, // 10 seconds
        connectTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000, // 45 seconds
        // For test environments, use shorter timeouts and disable retries to fail fast
        ...(process.env.NODE_ENV === 'test' && {
          serverSelectionTimeoutMS: 3000, // 3 seconds - fail fast
          connectTimeoutMS: 3000, // 3 seconds - fail fast
          socketTimeoutMS: 3000, // 3 seconds - fail fast
          maxPoolSize: 1, // Single connection for tests
          retryWrites: false, // Disable retries
          retryReads: false, // Disable retries
        }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
