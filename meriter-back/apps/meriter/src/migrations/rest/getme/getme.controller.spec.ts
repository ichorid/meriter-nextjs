import { Test, TestingModule } from '@nestjs/testing';
import { GetmeController } from './getme.controller';

describe('GetmeController', () => {
  let controller: GetmeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GetmeController],
    }).compile();

    controller = module.get<GetmeController>(GetmeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
