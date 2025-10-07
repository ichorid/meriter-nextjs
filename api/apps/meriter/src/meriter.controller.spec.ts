import { Test, TestingModule } from '@nestjs/testing';
import { MeriterController } from './meriter.controller';
import { MeriterService } from './meriter.service';

describe('MeriterController', () => {
  let meriterController: MeriterController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MeriterController],
      providers: [MeriterService],
    }).compile();

    meriterController = app.get<MeriterController>(MeriterController);
  });

  describe('root', () => {
    it('should return "Hello World!!!!"', () => {
      expect(meriterController.getHello()).toBe('Hello World!!!!');
    });
  });
});
