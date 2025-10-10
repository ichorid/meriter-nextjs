import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RestGetmeController } from './getme.controller';
import { UsersService } from '../../../users/users.service';

describe('RestGetmeController', () => {
  let controller: RestGetmeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestGetmeController],
      providers: [
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

    controller = module.get<RestGetmeController>(RestGetmeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
