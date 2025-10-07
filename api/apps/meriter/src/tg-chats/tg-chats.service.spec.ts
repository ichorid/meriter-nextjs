import { Test, TestingModule } from '@nestjs/testing';
import { TgChatsService } from './tg-chats.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';

describe('TgChatsService', () => {
  let service: TgChatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgChatsService,
        {
          provide: ActorsService,
          useValue: {
            model: {
              findOne: jest.fn(),
              find: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TgChatsService>(TgChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
