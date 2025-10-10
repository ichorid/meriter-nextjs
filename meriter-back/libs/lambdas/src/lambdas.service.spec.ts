import { Test, TestingModule } from '@nestjs/testing';
import { LambdasService } from './lambdas.service';

describe('LambdasService', () => {
  let service: LambdasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LambdasService],
    }).compile();

    service = module.get<LambdasService>(LambdasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
