import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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

    controller = module.get<SendmemoController>(SendmemoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
