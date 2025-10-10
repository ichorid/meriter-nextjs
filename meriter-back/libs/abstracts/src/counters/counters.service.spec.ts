import { Test, TestingModule } from '@nestjs/testing';
import { CountersService } from './counters.service';

import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './schema/counter.schema';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';

describe('CountersService', () => {
  let service: CountersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CountersService],
      imports: [
        DatabaseTestModule,
        MongooseModule.forFeature(
          [{ name: Counter.name, schema: CounterSchema }],
          'local-test',
        ),
      ],
    }).compile();

    service = module.get<CountersService>(CountersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('pushToCounter: should increment by meta condition', async () => {
    await service.pushToCounter(2, { selector: 'test' }, false);
    const newVal = await service.pushToCounter(3, { selector: 'test' }, false);
    expect(newVal.value).toBe(5);
  });

  it('getCounter', async () => {
    const val = await service.getCounter({ selector: 'test' });
    expect(val).toBe(5);
  });

  afterAll(async () => {
    await service.__testCleanup();
  });
});
