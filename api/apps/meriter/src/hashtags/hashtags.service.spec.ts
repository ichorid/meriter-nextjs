import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { HashtagsService } from './hashtags.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { Model } from 'mongoose';
import { Hashtag } from './model/hashtag.model';

describe('HashtagsService', () => {
  let service: HashtagsService;
  let actorsService: ActorsService;
  let mockModel: Model<Hashtag>;

  beforeEach(async () => {
    // Create mock model with common Mongoose methods
    mockModel = createMock<Model<Hashtag>>({
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    });

    // Create mock ActorsService
    const mockActorsService = createMock<ActorsService>({
      model: mockModel as any,
      upsert: jest.fn().mockResolvedValue({}),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashtagsService,
        {
          provide: ActorsService,
          useValue: mockActorsService,
        },
      ],
    }).compile();

    service = module.get<HashtagsService>(HashtagsService);
    actorsService = module.get<ActorsService>(ActorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getInChat', () => {
    it('should find hashtags by telegram chat id', async () => {
      const mockHashtags = [
        { uid: 'tag1', meta: { parentTgChatId: 'chat123' } },
        { uid: 'tag2', meta: { parentTgChatId: 'chat123' } },
      ];

      // Setup mock to return hashtags
      jest.spyOn(mockModel, 'find').mockResolvedValue(mockHashtags as any);

      const result = await service.getInChat('chat123');

      expect(mockModel.find).toHaveBeenCalledWith({
        'meta.parentTgChatId': 'chat123',
      });
      expect(result).toEqual(mockHashtags);
    });
  });

  describe('upsertList', () => {
    it('should delete old hashtags and upsert new ones', async () => {
      const tgChatId = 'chat123';
      const hashtags: Partial<Hashtag>[] = [
        { uid: 'tag1' },
        { uid: 'tag2' },
      ];

      jest.spyOn(actorsService.model, 'deleteMany').mockResolvedValue({
        deletedCount: 1,
      } as any);
      jest.spyOn(actorsService, 'upsert').mockResolvedValue({} as any);

      await service.upsertList(tgChatId, hashtags);

      // Verify deleteMany was called to remove old hashtags
      expect(actorsService.model.deleteMany).toHaveBeenCalledWith({
        'meta.parentTgChatId': tgChatId,
        uid: { $nin: ['tag1', 'tag2'] },
      });

      // Verify upsert was called for each hashtag
      expect(actorsService.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
