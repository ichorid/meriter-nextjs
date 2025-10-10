import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestPollsController } from './rest-polls.controller';
import { UsersService } from '../../../users/users.service';
import { PublicationsService } from '../../../publications/publications.service';
import { TransactionsService } from '../../../transactions/transactions.service';
import { WalletsService } from '../../../wallets/wallets.service';

describe('RestPollsController', () => {
  let controller: RestPollsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestPollsController],
      providers: [
        {
          provide: PublicationsService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: TransactionsService,
          useValue: {},
        },
        {
          provide: WalletsService,
          useValue: {},
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

    controller = module.get<RestPollsController>(RestPollsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

