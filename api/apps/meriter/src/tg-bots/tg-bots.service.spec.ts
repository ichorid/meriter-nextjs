import { Test, TestingModule } from '@nestjs/testing';
import { TgBotsService } from './tg-bots.service';
import { BOT_TOKEN } from '../config';
import { TgChatsService } from '../tg-chats/tg-chats.service';
import { UsersService } from '../users/users.service';
import { PublicationsService } from '../publications/publications.service';
import { HashtagsService } from '../hashtags/hashtags.service';
import { WalletsService } from '../wallets/wallets.service';

// Mock test IDs - these are randomly generated for testing purposes only
// They do not represent real user IDs
const ids = Array.from({ length: 90 }, (_, i) => 100000000 + i * 123456);

describe('TgBotsService', () => {
  let service: TgBotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgBotsService,
        {
          provide: TgChatsService,
          useValue: {
            upsert: jest.fn(),
            getInfo: jest.fn(),
            model: { find: jest.fn(), findOne: jest.fn() },
          },
        },
        {
          provide: UsersService,
          useValue: {
            upsert: jest.fn(),
            getByToken: jest.fn(),
            model: { findOne: jest.fn() },
          },
        },
        {
          provide: PublicationsService,
          useValue: {
            model: { find: jest.fn(), findOne: jest.fn(), create: jest.fn() },
          },
        },
        {
          provide: HashtagsService,
          useValue: {
            model: { findOne: jest.fn(), find: jest.fn() },
          },
        },
        {
          provide: WalletsService,
          useValue: {
            delta: jest.fn(),
            getValue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TgBotsService>(TgBotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  
  // Skip integration test that makes actual HTTP requests to Telegram API
  it.skip('should download avatar photo', async () => {
    const p = ids.map((i) =>
      service.telegramGetChatPhotoUrl(BOT_TOKEN, String(i)),
    );
    const pr = await Promise.all(p);

    expect(pr).toBeDefined();
  });
});
