import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Asset,
  AssetSchema,
} from '@common/abstracts/assets/schema/asset.schema';
import { AssetsService } from '@common/abstracts/assets/assets.service';
import { libsDatabaseConnectionName } from '@common/abstracts/helpers/database/config';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Asset.name, schema: AssetSchema }],
      libsDatabaseConnectionName,
    ),
  ],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
