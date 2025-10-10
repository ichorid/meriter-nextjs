import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.secret') return 'test-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<RestFreqController>(RestFreqController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
