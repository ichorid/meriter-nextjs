import { Test, TestingModule } from '@nestjs/testing';
import { AgreementsService } from './agreements.service';
import { getModelToken } from '@nestjs/mongoose';
import { Agreement } from './schema/agreement.schema';

describe('AgreementsService', () => {
  let service: AgreementsService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgreementsService,
        {
          provide: getModelToken(Agreement.name, 'default'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AgreementsService>(AgreementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
