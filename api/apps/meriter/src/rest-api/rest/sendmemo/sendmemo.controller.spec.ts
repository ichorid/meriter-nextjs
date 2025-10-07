import { Test, TestingModule } from '@nestjs/testing';
import { SendmemoController } from './sendmemo.controller';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UsersService } from '../../../users/users.service';

describe('SendmemoController', () => {
  let controller: SendmemoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SendmemoController],
      providers: [
        {
          provide: TgBotsService,
          useValue: { sendInfoLetter: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<SendmemoController>(SendmemoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
