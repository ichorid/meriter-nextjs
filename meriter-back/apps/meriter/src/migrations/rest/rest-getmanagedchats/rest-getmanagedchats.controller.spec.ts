import { Test, TestingModule } from '@nestjs/testing';
import { RestGetmanagedchatsController } from './rest-getmanagedchats.controller';

describe('RestGetmanagedchatsController', () => {
  let controller: RestGetmanagedchatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestGetmanagedchatsController],
    }).compile();

    controller = module.get<RestGetmanagedchatsController>(RestGetmanagedchatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
