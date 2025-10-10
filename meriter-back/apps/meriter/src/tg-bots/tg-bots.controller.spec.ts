import { Test, TestingModule } from '@nestjs/testing';
import { TgBotsController } from './tg-bots.controller';

describe('TgBotsController', () => {
  let controller: TgBotsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TgBotsController],
    }).compile();

    controller = module.get<TgBotsController>(TgBotsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
