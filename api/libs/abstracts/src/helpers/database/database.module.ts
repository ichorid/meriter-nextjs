import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const MONGO_URL_MERITER = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/meriter';

@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URL_MERITER, {
      connectionName: 'default',
    }),
  ],
})
export class DatabaseModule {}
