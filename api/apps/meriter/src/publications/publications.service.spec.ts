import { Test, TestingModule } from '@nestjs/testing';
import { PublicationsService } from './publications.service';
import { AssetsService } from '@common/abstracts/assets/assets.service';

describe('PublicationsService', () => {
  let service: PublicationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicationsService,
        {
          provide: AssetsService,
          useValue: {
            model: {
              find: jest.fn(),
              findOne: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PublicationsService>(PublicationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
