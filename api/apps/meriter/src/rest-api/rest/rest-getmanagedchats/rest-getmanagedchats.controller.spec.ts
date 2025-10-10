import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestGetmanagedchatsController } from './rest-getmanagedchats.controller';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UsersService } from '../../../users/users.service';

describe('RestGetmanagedchatsController', () => {
  let controller: RestGetmanagedchatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestGetmanagedchatsController],
      providers: [
        {
          provide: TgChatsService,
          useValue: { getInfo: jest.fn(), model: { find: jest.fn() } },
        },
        {
          provide: TgBotsService,
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<RestGetmanagedchatsController>(RestGetmanagedchatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
