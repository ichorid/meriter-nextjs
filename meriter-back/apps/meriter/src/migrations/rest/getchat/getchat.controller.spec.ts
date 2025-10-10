import { Test, TestingModule } from '@nestjs/testing';
import { GetchatController } from './getchat.controller';

describe('GetchatController', () => {
  let controller: GetchatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GetchatController],
    }).compile();

    controller = module.get<GetchatController>(GetchatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
