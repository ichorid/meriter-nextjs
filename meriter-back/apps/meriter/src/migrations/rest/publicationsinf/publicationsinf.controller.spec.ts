import { Test, TestingModule } from '@nestjs/testing';
import { PublicationsinfController } from './publicationsinf.controller';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Asset,
  AssetSchema,
} from '@common/abstracts/assets/schema/asset.schema';
import { PublicationsService } from '../../../publications/publications.service';
import { AssetsModule } from '@common/abstracts/assets/assets.module';
import { AssetsService } from '@common/abstracts/assets/assets.service';

describe('PublicationsinfController', () => {
  let controller: PublicationsinfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicationsService],
      imports: [
        DatabaseTestModule,
        MongooseModule.forFeature(
          [{ name: Asset.name, schema: AssetSchema }],
          'local-test',
        ),
        AssetsModule,
      ],

      controllers: [PublicationsinfController],
    }).compile();

    controller = module.get<PublicationsinfController>(
      PublicationsinfController,
    );
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();
    //const p = await controller.publicationsinf('/c/-400774319', 0, 10);
  });
});
