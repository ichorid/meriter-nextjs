import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: ActorsService,
          useValue: {
            model: {
              findOne: jest.fn(),
              find: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
