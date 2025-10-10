import { Test, TestingModule } from '@nestjs/testing';
import { RestTransactionsController } from './rest-transactions.controller';

describe('RestTransactionsController', () => {
  let controller: RestTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestTransactionsController],
    }).compile();

    controller = module.get<RestTransactionsController>(RestTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
