import { Test, TestingModule } from '@nestjs/testing';
import { TgChatsService } from './tg-chats.service';

describe('TgChatsService', () => {
  let service: TgChatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TgChatsService],
    }).compile();

    service = module.get<TgChatsService>(TgChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
