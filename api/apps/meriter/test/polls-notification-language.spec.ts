import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { Model } from 'mongoose';
import { PollsController } from '../src/api-v1/polls/polls.controller';
import { PollService } from '../src/domain/services/poll.service';
import { PollCastService } from '../src/domain/services/poll-cast.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { TgBotsService } from '../src/tg-bots/tg-bots.service';
import { UserGuard } from '../src/user.guard';
import { Poll, PollDocument } from '../src/domain/models/poll/poll.schema';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { CreatePollDto } from '@meriter/shared-types';
import { uid } from 'uid';

class AllowAllGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Preserve user if already set, otherwise use default
    if (!req.user) {
      req.user = { id: 'test-user-id' };
    }
    return true;
  }
}

describe('PollsController - Notification Language', () => {
  let controller: PollsController;
  let pollService: jest.Mocked<PollService>;
  let communityService: jest.Mocked<CommunityService>;
  let tgBotsService: jest.Mocked<TgBotsService>;
  let mockCommunityModel: Model<CommunityDocument>;

  beforeEach(async () => {
    // Create mock models
    mockCommunityModel = createMock<Model<CommunityDocument>>();

    // Create mock services
    const mockPollService = {
      createPoll: jest.fn(),
      getPoll: jest.fn(),
      getPollsByCommunity: jest.fn(),
      getPollsByUser: jest.fn(),
      getPollResults: jest.fn(),
      getUserCasts: jest.fn(),
      updatePollForCast: jest.fn(),
    };

    const mockPollCastService = {
      createCast: jest.fn(),
    };

    const mockWalletService = {
      getWallet: jest.fn(),
      addTransaction: jest.fn(),
    };

    const mockCommunityService = {
      getCommunity: jest.fn(),
    };

    const mockUserService = {
      getUser: jest.fn(),
    };

    const mockTgBotsService = {
      tgSend: jest.fn(),
      getCommunityLanguageByChatId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        {
          provide: PollService,
          useValue: mockPollService,
        },
        {
          provide: PollCastService,
          useValue: mockPollCastService,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: TgBotsService,
          useValue: mockTgBotsService,
        },
        {
          provide: getModelToken(Community.name),
          useValue: mockCommunityModel,
        },
      ],
    })
      .overrideGuard(UserGuard)
      .useClass(AllowAllGuard)
      .compile();

    controller = module.get<PollsController>(PollsController);
    pollService = module.get(PollService) as jest.Mocked<PollService>;
    communityService = module.get(CommunityService) as jest.Mocked<CommunityService>;
    tgBotsService = module.get(TgBotsService) as jest.Mocked<TgBotsService>;
  });

  it('should send poll notification in Russian when community language is set to "ru"', async () => {
    const communityId = uid();
    const telegramChatId = '-1001234567890';
    const userId = uid();
    const pollId = uid();

    // Create a poll DTO
    const createPollDto: CreatePollDto = {
      communityId,
      question: 'What is your favorite color?',
      description: 'Test poll',
      options: [
        { text: 'Red' },
        { text: 'Blue' },
        { text: 'Green' },
      ],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Mock community with Russian language setting
    const mockCommunity = {
      id: communityId,
      telegramChatId,
      name: 'Test Community',
      settings: {
        language: 'ru' as const,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
    };

    // Mock poll snapshot
    const mockPollSnapshot = {
      id: pollId,
      authorId: userId,
      communityId,
      question: createPollDto.question,
      description: createPollDto.description,
      options: createPollDto.options.map((opt, idx) => ({
        id: `opt-${idx}`,
        text: opt.text,
        votes: 0,
        amount: 0,
        casterCount: 0,
      })),
      metrics: {
        totalCasts: 0,
        casterCount: 0,
        totalAmount: 0,
      },
      expiresAt: new Date(createPollDto.expiresAt),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock poll entity
    const mockPoll = {
      toSnapshot: () => mockPollSnapshot,
    } as any;

    // Setup mocks
    pollService.createPoll.mockResolvedValue(mockPoll);
    communityService.getCommunity.mockResolvedValue(mockCommunity as any);
    tgBotsService.getCommunityLanguageByChatId.mockResolvedValue('ru');

    // Call createPoll
    const req = { user: { id: userId } } as any;
    await controller.createPoll(createPollDto, req);

    // Verify getCommunityLanguageByChatId was called with the correct chat ID
    expect(tgBotsService.getCommunityLanguageByChatId).toHaveBeenCalledWith(telegramChatId);
    
    // Verify tgBotsService.tgSend was called
    expect(tgBotsService.tgSend).toHaveBeenCalledTimes(1);

    // Get the call arguments
    const tgSendCall = tgBotsService.tgSend.mock.calls[0];
    const [sendArgs] = tgSendCall;
    
    expect(sendArgs.tgChatId).toBe(telegramChatId);
    
    // Verify the message contains Russian text
    // The Russian translation for 'poll.created' should contain 'Новый опрос'
    const messageText = sendArgs.text;
    expect(messageText).toContain('Новый опрос'); // Russian for "New poll"
    expect(messageText).toContain(createPollDto.question);
  });

  it('should send poll notification in English when community language is set to "en"', async () => {
    const communityId = uid();
    const telegramChatId = '-1001234567890';
    const userId = uid();
    const pollId = uid();

    // Create a poll DTO
    const createPollDto: CreatePollDto = {
      communityId,
      question: 'What is your favorite color?',
      description: 'Test poll',
      options: [
        { text: 'Red' },
        { text: 'Blue' },
        { text: 'Green' },
      ],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    // Mock community with English language setting
    const mockCommunity = {
      id: communityId,
      telegramChatId,
      name: 'Test Community',
      settings: {
        language: 'en' as const,
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 10,
      },
    };

    // Mock poll snapshot
    const mockPollSnapshot = {
      id: pollId,
      authorId: userId,
      communityId,
      question: createPollDto.question,
      description: createPollDto.description,
      options: createPollDto.options.map((opt, idx) => ({
        id: `opt-${idx}`,
        text: opt.text,
        votes: 0,
        amount: 0,
        casterCount: 0,
      })),
      metrics: {
        totalCasts: 0,
        casterCount: 0,
        totalAmount: 0,
      },
      expiresAt: new Date(createPollDto.expiresAt),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock poll entity
    const mockPoll = {
      toSnapshot: () => mockPollSnapshot,
    } as any;

    // Setup mocks
    pollService.createPoll.mockResolvedValue(mockPoll);
    communityService.getCommunity.mockResolvedValue(mockCommunity as any);
    tgBotsService.getCommunityLanguageByChatId.mockResolvedValue('en');

    // Call createPoll
    const req = { user: { id: userId } } as any;
    await controller.createPoll(createPollDto, req);

    // Verify getCommunityLanguageByChatId was called with the correct chat ID
    expect(tgBotsService.getCommunityLanguageByChatId).toHaveBeenCalledWith(telegramChatId);
    
    // Verify tgBotsService.tgSend was called
    expect(tgBotsService.tgSend).toHaveBeenCalledTimes(1);

    // Get the call arguments
    const tgSendCall = tgBotsService.tgSend.mock.calls[0];
    const [sendArgs] = tgSendCall;
    
    expect(sendArgs.tgChatId).toBe(telegramChatId);
    
    // Verify the message contains English text
    // The English translation for 'poll.created' should contain 'New poll'
    const messageText = sendArgs.text;
    expect(messageText).toContain('New poll'); // English text
    expect(messageText).toContain(createPollDto.question);
  });
});

