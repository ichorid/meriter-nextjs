import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PublicationSchemaClass,
  PublicationSchema,
} from '../models/publication/publication.schema';
import { PostClosingCronService } from './post-closing-cron.service';
import { DomainModule } from '../../domain.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: PublicationSchemaClass.name, schema: PublicationSchema },
    ]),
    DomainModule,
  ],
  providers: [PostClosingCronService],
  exports: [PostClosingCronService],
})
export class PostClosingCronModule {}
