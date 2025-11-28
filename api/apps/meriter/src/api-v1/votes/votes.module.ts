import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VotesController } from './votes.controller';
import { DomainModule } from '../../domain.module';
import {
  Publication,
  PublicationSchema,
} from '../../domain/models/publication/publication.schema';

@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: Publication.name, schema: PublicationSchema },
    ]),
  ],
  controllers: [VotesController],
})
export class VotesModule {}
