import { Test, TestingModule } from '@nestjs/testing';
import { WalletsService } from './wallets.service';
import { CountersService } from '@common/abstracts/counters/counters.service';
import { DatabaseTestModule } from '@common/abstracts/helpers/database/database-test.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from '@common/abstracts/counters/schema/counter.schema';
import { CountersModule } from '@common/abstracts/counters/counters.module';

describe('WalletsService', () => {
  let service: WalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletsService, CountersService],

      imports: [
        DatabaseTestModule,
        MongooseModule.forFeature(
          [{ name: Counter.name, schema: CounterSchema }],
          'local-test',
        ),
        CountersModule,
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should give right delta', async () => {
    await service.delta(1, { test: 123 });
    const v = await service.get({ test: 123 });
    expect(v).toBe(1);
  });
});
