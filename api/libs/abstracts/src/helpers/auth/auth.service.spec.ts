import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ActorsService,
          useValue: {
            findByUsername: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
