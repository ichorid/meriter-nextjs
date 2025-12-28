import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfig>) => ({
        uri: ((configService.get as any)('database.mongoUrl') ?? 'mongodb://127.0.0.1:27017/meriter') as string,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
