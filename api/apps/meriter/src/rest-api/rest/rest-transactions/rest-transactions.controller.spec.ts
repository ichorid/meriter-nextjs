import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestTransactionsController } from './rest-transactions.controller';
import { TransactionsService } from '../../../transactions/transactions.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { PublicationsService } from '../../../publications/publications.service';
import { UsersService } from '../../../users/users.service';

describe('RestTransactionsController', () => {
  let controller: RestTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestTransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            rankInHashtag: jest.fn(),
            forPublication: jest.fn(),
            withdraw: jest.fn(),
          },
        },
        {
          provide: TgBotsService,
          useValue: { sendMessage: jest.fn() },
        },
        {
          provide: PublicationsService,
          useValue: { model: { findOne: jest.fn() } },
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

    controller = module.get<RestTransactionsController>(RestTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
