import { Test, TestingModule } from '@nestjs/testing';
import { UpdatesConductorsService } from './updates-conductors.service';
import { getModelToken } from '@nestjs/mongoose';
import { UpdatesConductor } from './model/updates-conductor.schema';
import { TgBotsService } from '../tg-bots/tg-bots.service';

describe('UpdatesConductorsService', () => {
  let service: UpdatesConductorsService;

  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatesConductorsService,
        {
          provide: getModelToken(UpdatesConductor.name, 'default'),
          useValue: mockModel,
        },
        {
          provide: TgBotsService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UpdatesConductorsService>(UpdatesConductorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
