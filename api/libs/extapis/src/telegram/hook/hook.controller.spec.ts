import { Test, TestingModule } from '@nestjs/testing';
import { TelegramHookController } from './hook.controller';
import { TelegramHookService } from './hook.service';

describe('TelegramHookController', () => {
  let controller: TelegramHookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramHookController],
      providers: [
        {
          provide: TelegramHookService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<TelegramHookController>(TelegramHookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
