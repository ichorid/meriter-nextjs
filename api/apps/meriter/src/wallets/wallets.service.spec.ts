import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service';
import { CountersService } from '@common/abstracts/counters/counters.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { TestDatabaseHelper } from '../../test/test-db.helper';

describe('WalletsService', () => {
  let service: WalletsService;
  let module: TestingModule;
  let dbHelper: TestDatabaseHelper;
  let countersService: CountersService;

  beforeEach(async () => {
    dbHelper = new TestDatabaseHelper();
    const uri = await dbHelper.start();

    module = await Test.createTestingModule({
      providers: [WalletsService, CountersService],
      imports: [
        MongooseModule.forRoot(uri, { connectionName: 'default' }),
        MongooseModule.forFeature(
          [{ name: Counter.name, schema: CounterSchema }],
          'default',
        ),
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    countersService = module.get<CountersService>(CountersService);
  }, 30000);

  afterEach(async () => {
    if (countersService?.__testCleanup) {
      await countersService.__testCleanup();
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
  
  it('should give right delta', async () => {
    await service.delta(1, { test: 123 });
    const v = await service.getValue({ test: 123 });
    expect(v).toBe(1);
  });
});
