import { Test, TestingModule } from '@nestjs/testing';
import { TelegramHookController } from './hook.controller';
import { TgBotsService } from '../tg-bots.service';

describe('HookController', () => {
  let controller: TelegramHookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramHookController],
      providers: [
        {
          provide: TgBotsService,
          useValue: {
            telegramHook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TelegramHookController>(TelegramHookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
