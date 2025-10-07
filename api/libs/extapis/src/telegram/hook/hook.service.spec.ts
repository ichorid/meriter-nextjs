import { Test, TestingModule } from '@nestjs/testing';
import { TelegramHookService } from './hook.service';

describe('TelegramHookService', () => {
  let service: TelegramHookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelegramHookService],
    }).compile();

    service = module.get<TelegramHookService>(TelegramHookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
