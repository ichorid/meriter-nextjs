import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

const MONGO_URL_MERITER = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/meriter';

@Module({
  imports: [
    MongooseModule.forRoot(MONGO_URL_MERITER, {
      connectionName: 'remote-prod-2',
      useFindAndModify: true,
    }),
    MongooseModule.forRoot(MONGO_URL_MERITER, {
      connectionName: 'remote-prod',
      useFindAndModify: true,
    }),
    MongooseModule.forRoot(MONGO_URL_MERITER, {
      connectionName: 'local-test',
      useFindAndModify: true,
    }),
  ],
})
export class DatabaseModule {}
