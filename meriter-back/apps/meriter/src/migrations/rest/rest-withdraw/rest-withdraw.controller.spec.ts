import { Test, TestingModule } from '@nestjs/testing';
import { RestWithdrawController } from './rest-withdraw.controller';

describe('RestWithdrawController', () => {
  let controller: RestWithdrawController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestWithdrawController],
    }).compile();

    controller = module.get<RestWithdrawController>(RestWithdrawController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
