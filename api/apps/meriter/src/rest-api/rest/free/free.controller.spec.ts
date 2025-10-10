import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestFreeController } from './free.controller';
import { UsersService } from '../../../users/users.service';
import { TransactionsService } from '../../../transactions/transactions.service';

describe('RestFreeController', () => {
  let controller: RestFreeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestFreeController],
      providers: [
        {
          provide: TransactionsService,
          useValue: { getFreeLimit: jest.fn() },
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

    controller = module.get<RestFreeController>(RestFreeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
