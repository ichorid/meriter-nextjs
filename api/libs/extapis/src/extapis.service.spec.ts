import { Test, TestingModule } from '@nestjs/testing';
import { ExtapisService } from './extapis.service';

describe('ExtapisService', () => {
  let service: ExtapisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExtapisService],
    }).compile();

    service = module.get<ExtapisService>(ExtapisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
