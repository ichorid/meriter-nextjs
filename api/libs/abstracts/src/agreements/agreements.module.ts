import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Agreement,
  AgreementSchema,
} from '@common/abstracts/agreements/schema/agreement.schema';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { libsDatabaseConnectionName } from '@common/abstracts/helpers/database/config';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Agreement.name, schema: AgreementSchema }],
      libsDatabaseConnectionName,
    ),
  ],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
