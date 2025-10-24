import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { WalletsService } from '../wallets/wallets.service';
import { AgreementsService } from '@common/abstracts/agreements/agreements.service';
import { PublicationsService } from '../publications/publications.service';
import { UsersService } from '../users/users.service';
import { HashtagsService } from '../hashtags/hashtags.service';
import { UpdatesConductorsService } from '../updates-conductors/updates-conductors.service';
import { TransactionForPublicationDTO } from './model/transaction-for-publication.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let publicationsService: PublicationsService;
  let walletsService: WalletsService;
  let updatesConductorsService: UpdatesConductorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: WalletsService,
          useValue: { 
            delta: jest.fn(), 
            getValue: jest.fn(),
            initWallet: jest.fn(),
          },
        },
        {
          provide: AgreementsService,
          useValue: {
            model: {
              aggregate: jest.fn().mockReturnThis(),
              sort: jest.fn(),
              findOne: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: PublicationsService,
          useValue: { 
            model: { 
              findOne: jest.fn(),
              create: jest.fn(),
            },
            deltaByUid: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: { 
            model: { findOne: jest.fn() },
            actorsService: {
              getTelegramByActorUri: jest.fn(),
            },
          },
        },
        {
          provide: HashtagsService,
          useValue: { model: { findOne: jest.fn() } },
        },
        {
          provide: UpdatesConductorsService,
          useValue: { pushUpdate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    publicationsService = module.get<PublicationsService>(PublicationsService);
    walletsService = module.get<WalletsService>(WalletsService);
    updatesConductorsService = module.get<UpdatesConductorsService>(UpdatesConductorsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createForPublication', () => {
    it('should allow author to vote on their own post when there is a beneficiary', async () => {
      const authorTgId = '123456789';
      const beneficiaryTgId = '987654321';
      const publicationUid = 'test-publication-uid';

      const mockPublication = {
        uid: publicationUid,
        meta: {
          author: {
            telegramId: authorTgId,
            name: 'Author',
          },
          beneficiary: {
            telegramId: beneficiaryTgId,
            name: 'Beneficiary',
          },
          origin: {
            telegramChatId: '-1001234567890',
          },
          hashtagSlug: 'test-hashtag',
        },
      };

      const dto: TransactionForPublicationDTO = {
        forPublicationUid: publicationUid,
        fromUserTgId: authorTgId,
        fromUserTgName: 'Author',
        amount: 100,
        comment: 'Test vote',
      };

      // Mock the services
      jest.spyOn(publicationsService.model, 'findOne').mockResolvedValue(mockPublication as any);
      jest.spyOn(service, 'approveAndSplitAmounts').mockResolvedValue({ personal: 50, free: 50 });
      jest.spyOn(walletsService, 'delta').mockResolvedValue(undefined);
      jest.spyOn(walletsService, 'initWallet').mockResolvedValue(undefined);
      jest.spyOn(service, 'deltaByUid').mockResolvedValue(undefined);
      jest.spyOn(service.model, 'create').mockResolvedValue({} as any);
      jest.spyOn(updatesConductorsService, 'pushUpdate').mockResolvedValue(undefined);

      // This should not throw an error
      await expect(service.createForPublication(dto)).resolves.not.toThrow();
    });

    it('should prevent author from voting on their own post when there is no beneficiary', async () => {
      const authorTgId = '123456789';
      const publicationUid = 'test-publication-uid';

      const mockPublication = {
        uid: publicationUid,
        meta: {
          author: {
            telegramId: authorTgId,
            name: 'Author',
          },
          // No beneficiary
          origin: {
            telegramChatId: '-1001234567890',
          },
          hashtagSlug: 'test-hashtag',
        },
      };

      const dto: TransactionForPublicationDTO = {
        forPublicationUid: publicationUid,
        fromUserTgId: authorTgId,
        fromUserTgName: 'Author',
        amount: 100,
        comment: 'Test vote',
      };

      // Mock the services
      jest.spyOn(publicationsService.model, 'findOne').mockResolvedValue(mockPublication as any);
      jest.spyOn(service, 'approveAndSplitAmounts').mockResolvedValue({ personal: 50, free: 50 });
      jest.spyOn(walletsService, 'delta').mockResolvedValue(undefined);
      jest.spyOn(walletsService, 'initWallet').mockResolvedValue(undefined);
      jest.spyOn(service, 'deltaByUid').mockResolvedValue(undefined);
      jest.spyOn(service.model, 'create').mockResolvedValue({} as any);
      jest.spyOn(updatesConductorsService, 'pushUpdate').mockResolvedValue(undefined);

      // This should throw an error
      try {
        await service.createForPublication(dto);
        fail('Expected method to throw an error');
      } catch (error) {
        expect(error).toBe('cannot vote for self');
        // Enhanced: Verify error message is specific and meaningful
        expect(typeof error).toBe('string');
        expect(error).toContain('cannot vote for self');
      }
    });
  });
});
