import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PollsController } from '../src/api-v1/polls/polls.controller';
import { PollService } from '../src/domain/services/poll.service';
import { PollCastService } from '../src/domain/services/poll-cast.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityService } from '../src/domain/services/community.service';
import { UserService } from '../src/domain/services/user.service';
import { PermissionService } from '../src/domain/services/permission.service';
import { TgBotsService } from '../src/tg-bots/tg-bots.service';
import { UserEnrichmentService } from '../src/api-v1/common/services/user-enrichment.service';
import { CommunityEnrichmentService } from '../src/api-v1/common/services/community-enrichment.service';
import { UserGuard } from '../src/user.guard';
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
  let module: TestingModule;

  beforeEach(async () => {
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

    const mockPermissionService = {
      canCreatePoll: jest.fn().mockResolvedValue(true),
    };

    const mockTgBotsService = {
      tgSend: jest.fn(),
      getCommunityLanguageByChatId: jest.fn(),
    };

    module = await Test.createTestingModule({
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
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: TgBotsService,
          useValue: mockTgBotsService,
        },
        {
          provide: UserEnrichmentService,
          useValue: {
            batchFetchUsers: jest.fn().mockResolvedValue(new Map()),
          },
        },
        {
          provide: CommunityEnrichmentService,
          useValue: {
            batchFetchCommunities: jest.fn().mockResolvedValue(new Map()),
          },
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

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should not send poll notification when Telegram notifications are disabled', async () => {
    const communityId = uid();
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

    // Call createPoll
    const req = { user: { id: userId } } as any;
    const result = await controller.createPoll(createPollDto, req);

    // Verify tgBotsService.tgSend was NOT called (notifications are disabled)
    expect(tgBotsService.tgSend).not.toHaveBeenCalled();
    
    // Verify the poll was created successfully
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(pollId);
    expect(pollService.createPoll).toHaveBeenCalledWith(userId, expect.objectContaining({
      communityId,
      question: createPollDto.question,
    }));
  });

  it('should create poll successfully without sending notifications', async () => {
    const communityId = uid();
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

    // Call createPoll
    const req = { user: { id: userId } } as any;
    const result = await controller.createPoll(createPollDto, req);

    // Verify tgBotsService.tgSend was NOT called (notifications are disabled)
    expect(tgBotsService.tgSend).not.toHaveBeenCalled();
    
    // Verify the poll was created successfully
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(pollId);
    expect(result.data.question).toBe(createPollDto.question);
  });
});

