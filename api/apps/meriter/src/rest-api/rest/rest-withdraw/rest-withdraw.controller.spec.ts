import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestWithdrawController } from './rest-withdraw.controller';
import { TransactionsService } from '../../../transactions/transactions.service';
import { UsersService } from '../../../users/users.service';

describe('RestWithdrawController', () => {
  let controller: RestWithdrawController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestWithdrawController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            withdrawFromTransaction: jest.fn(),
            withdrawFromPublication: jest.fn(),
          },
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

    controller = module.get<RestWithdrawController>(RestWithdrawController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
