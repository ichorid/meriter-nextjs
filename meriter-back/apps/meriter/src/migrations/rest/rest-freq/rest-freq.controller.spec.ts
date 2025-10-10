import { Test, TestingModule } from '@nestjs/testing';
import { RestFreqController } from './rest-freq.controller';

describe('RestFreqController', () => {
  let controller: RestFreqController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestFreqController],
    }).compile();

    controller = module.get<RestFreqController>(RestFreqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
