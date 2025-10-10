import { Test, TestingModule } from '@nestjs/testing';
import { RestWalletController } from './wallet.controller';

describe('WalletController', () => {
  let controller: RestWalletController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestWalletController],
    }).compile();

    controller = module.get<RestWalletController>(RestWalletController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
