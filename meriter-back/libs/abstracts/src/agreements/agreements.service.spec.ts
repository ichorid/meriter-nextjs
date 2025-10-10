import { Test, TestingModule } from '@nestjs/testing';
import { AgreementsService } from './agreements.service';

describe('AgreementsService', () => {
  let service: AgreementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgreementsService],
    }).compile();

    service = module.get<AgreementsService>(AgreementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
