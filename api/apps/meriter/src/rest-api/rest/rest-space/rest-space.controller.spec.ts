import { Test, TestingModule } from '@nestjs/testing';
import { RestSpaceController } from './rest-space.controller';
import { HashtagsService } from '../../../hashtags/hashtags.service';

describe('RestSpaceController', () => {
  let controller: RestSpaceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestSpaceController],
      providers: [
        {
          provide: HashtagsService,
          useValue: {
            model: {
              findOne: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<RestSpaceController>(RestSpaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
