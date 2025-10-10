import { Test, TestingModule } from '@nestjs/testing';
import { SendmemoController } from './sendmemo.controller';

describe('SendmemoController', () => {
  let controller: SendmemoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SendmemoController],
    }).compile();

    controller = module.get<SendmemoController>(SendmemoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
