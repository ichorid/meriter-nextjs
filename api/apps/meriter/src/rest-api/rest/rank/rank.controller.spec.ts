import { Test, TestingModule } from '@nestjs/testing';
import { RestRankController } from './rank.controller';
import { TransactionsService } from '../../../transactions/transactions.service';

describe('RestRankController', () => {
  let controller: RestRankController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestRankController],
      providers: [
        {
          provide: TransactionsService,
          useValue: { rankInHashtag: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<RestRankController>(RestRankController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
