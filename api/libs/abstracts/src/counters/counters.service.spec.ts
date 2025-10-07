import { Test, TestingModule } from '@nestjs/testing';
import { CountersService } from './counters.service';

import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './schema/counter.schema';
import { TestDatabaseHelper } from '../../../../apps/meriter/test/test-db.helper';

describe('CountersService', () => {
  let service: CountersService;
  let module: TestingModule;
  let dbHelper: TestDatabaseHelper;

  beforeEach(async () => {
    dbHelper = new TestDatabaseHelper();
    const uri = await dbHelper.start();

    module = await Test.createTestingModule({
      providers: [CountersService],
      imports: [
        MongooseModule.forRoot(uri, { connectionName: 'default' }),
        MongooseModule.forFeature(
          [{ name: Counter.name, schema: CounterSchema }],
          'default',
        ),
      ],
    }).compile();

    service = module.get<CountersService>(CountersService);
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

  it('pushToCounter: should increment by meta condition', async () => {
    await service.pushToCounter('test', 2, { selector: 'test' }, false);
    const newVal = await service.pushToCounter('test', 3, { selector: 'test' }, false);
    expect(newVal.value).toBe(5);
  });

  it('getCounter', async () => {
    await service.pushToCounter('test', 5, { selector: 'test2' }, false);
    const val = await service.getCounter({ selector: 'test2' });
    expect(val).toBe(5);
  });
});
