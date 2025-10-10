import { Test, TestingModule } from '@nestjs/testing';
import { RestUserdataController } from './userdata.controller';

describe('UserdataController', () => {
  let controller: RestUserdataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestUserdataController],
    }).compile();

    controller = module.get<RestUserdataController>(RestUserdataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
