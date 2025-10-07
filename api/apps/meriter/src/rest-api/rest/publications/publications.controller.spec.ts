import { Test, TestingModule } from '@nestjs/testing';
import { RestPublicationsController } from './publications.controller';

describe('RestPublicationsController', () => {
  let controller: RestPublicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestPublicationsController],
    }).compile();

    controller = module.get<RestPublicationsController>(RestPublicationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
