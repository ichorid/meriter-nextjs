import { Test, TestingModule } from '@nestjs/testing';
import { TgBotsService } from './tg-bots.service';
import { BOT_TOKEN } from '../config';
import { MeriterModule } from '../meriter.module';
import { TgChatsModule } from '../tg-chats/tg-chats.module';
import { UsersModule } from '../users/users.module';
import { PublicationsModule } from '../publications/publications.module';
import { HashtagsModule } from '../hashtags/hashtags.module';
import { WalletsModule } from '../wallets/wallets.module';

// Mock test IDs - these are randomly generated for testing purposes only
// They do not represent real user IDs
const ids = Array.from({ length: 90 }, (_, i) => 100000000 + i * 123456);

describe('TgBotsService', () => {
  let service: TgBotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TgChatsModule,
        UsersModule,
        PublicationsModule,
        HashtagsModule,
        WalletsModule,
      ],
      providers: [TgBotsService],
    }).compile();

    service = module.get<TgBotsService>(TgBotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should download avatar photo', async () => {
    const p = ids.map((i) =>
      service.telegramGetChatPhotoUrl(BOT_TOKEN, String(i)),
    );
    const pr = await Promise.all(p);

    expect(pr).toBeDefined();
  });
});
