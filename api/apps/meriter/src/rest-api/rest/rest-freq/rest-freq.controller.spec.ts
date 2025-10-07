import { Test, TestingModule } from '@nestjs/testing';
import { RestFreqController } from './rest-freq.controller';
import { UpdatesConductorsService } from '../../../updates-conductors/updates-conductors.service';
import { UsersService } from '../../../users/users.service';

describe('RestFreqController', () => {
  let controller: RestFreqController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestFreqController],
      providers: [
        {
          provide: UpdatesConductorsService,
          useValue: {
            getFrequency: jest.fn(),
            setFrequency: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: { getByToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<RestFreqController>(RestFreqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
