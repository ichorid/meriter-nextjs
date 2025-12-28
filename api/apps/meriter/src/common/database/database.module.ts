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
        // For test environments, use shorter timeouts
        ...(process.env.NODE_ENV === 'test' && {
          serverSelectionTimeoutMS: 5000, // 5 seconds
          connectTimeoutMS: 5000, // 5 seconds
          socketTimeoutMS: 5000, // 5 seconds
        }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
