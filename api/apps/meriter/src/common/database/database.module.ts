import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URL') || 'mongodb://127.0.0.1:27017/meriter',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
