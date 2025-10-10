import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Actor,
  ActorSchema,
} from '@common/abstracts/actors/schema/actor.schema';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { DatabaseModule } from '@common/abstracts/helpers/database/database.module';
import { libsDatabaseConnectionName } from '@common/abstracts/helpers/database/config';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature(
      [{ name: Actor.name, schema: ActorSchema }],
      libsDatabaseConnectionName ?? 'local-test',
    ),
  ],
  providers: [ActorsService],
  exports: [ActorsService],
})
export class ActorsModule {}
