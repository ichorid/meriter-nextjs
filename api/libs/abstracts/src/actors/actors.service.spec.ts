import { Test, TestingModule } from '@nestjs/testing';
import { ActorsService } from './actors.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Actor,
  ActorSchema,
} from '@common/abstracts/actors/schema/actor.schema';
import { TestDatabaseHelper } from '../../../../apps/meriter/test/test-db.helper';

describe('ActorsService', () => {
  let service: ActorsService;
  let module: TestingModule;
  let dbHelper: TestDatabaseHelper;

  beforeEach(async () => {
    dbHelper = new TestDatabaseHelper();
    const uri = await dbHelper.start();

    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri, { connectionName: 'default' }),
        MongooseModule.forFeature(
          [{ name: Actor.name, schema: ActorSchema }],
          'default',
        ),
      ],

      providers: [ActorsService],
    }).compile();

    service = module.get<ActorsService>(ActorsService);
  }, 30000);

  afterEach(async () => {
    if (service?.__testCleanup) {
      await service.__testCleanup();
    }
    if (module) {
      await module.close();
    }
    if (dbHelper) {
      await dbHelper.stop();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should upsert value', async () => {
    const result = await service.upsert(
      'test',
      { 'meta.test': 1 },
      {
        meta: { test: 1 },
      },
    );
    expect(result).toBeDefined();
    expect(result.domainName).toBe('test');
  });
});
