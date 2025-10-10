import { Test, TestingModule } from '@nestjs/testing';
import { UpdatesConductorsService } from './updates-conductors.service';

describe('UpdatesConductorsService', () => {
  let service: UpdatesConductorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdatesConductorsService],
    }).compile();

    service = module.get<UpdatesConductorsService>(UpdatesConductorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
