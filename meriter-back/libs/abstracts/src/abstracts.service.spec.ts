import { Test, TestingModule } from '@nestjs/testing';
import { AbstractsService } from './abstracts.service';

describe('AbstractsService', () => {
  let service: AbstractsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbstractsService],
    }).compile();

    service = module.get<AbstractsService>(AbstractsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
