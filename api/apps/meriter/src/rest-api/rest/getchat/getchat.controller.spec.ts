import { Test, TestingModule } from '@nestjs/testing';
import { GetchatController } from './getchat.controller';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';

describe('GetchatController', () => {
  let controller: GetchatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GetchatController],
      providers: [
        {
          provide: TgChatsService,
          useValue: {
            getInfo: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GetchatController>(GetchatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
