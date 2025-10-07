import { Test, TestingModule } from '@nestjs/testing';
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
      ],
    }).compile();

    controller = module.get<RestFreeController>(RestFreeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
