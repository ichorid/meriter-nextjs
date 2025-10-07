import { Test, TestingModule } from '@nestjs/testing';
import { TgSyncService } from './tg-sync.service';

describe('TgSyncService', () => {
  let service: TgSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TgSyncService],
    }).compile();

    service = module.get<TgSyncService>(TgSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
