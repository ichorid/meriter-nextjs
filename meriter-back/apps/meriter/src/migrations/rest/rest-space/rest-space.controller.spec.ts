import { Test, TestingModule } from '@nestjs/testing';
import { RestSpaceController } from './rest-space.controller';

describe('RestSpaceController', () => {
  let controller: RestSpaceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestSpaceController],
    }).compile();

    controller = module.get<RestSpaceController>(RestSpaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
