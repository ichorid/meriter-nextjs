import { Test, TestingModule } from '@nestjs/testing';
import { TelegramHookController } from './hook.controller';

describe('HookController', () => {
  let controller: TelegramHookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramHookController],
    }).compile();

    controller = module.get<TelegramHookController>(TelegramHookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
