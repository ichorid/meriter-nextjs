import { Test, TestingModule } from '@nestjs/testing';
import { RestRateController } from './rest-rate.controller';

describe('RestRateController', () => {
  let controller: RestRateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestRateController],
    }).compile();

    controller = module.get<RestRateController>(RestRateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
