import { Test, TestingModule } from '@nestjs/testing';
import { RestCommunityifoController } from './communityinfo.controller';

describe('CommunityinfoController', () => {
  let controller: RestCommunityifoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestCommunityifoController],
    }).compile();

    controller = module.get<RestCommunityifoController>(
      RestCommunityifoController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
