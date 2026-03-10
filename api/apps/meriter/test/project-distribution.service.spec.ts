import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProjectDistributionService } from '../src/domain/services/project-distribution.service';
import { CommunityService } from '../src/domain/services/community.service';
import { TicketService } from '../src/domain/services/ticket.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { CommunityWalletService } from '../src/domain/services/community-wallet.service';
import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { NotificationService } from '../src/domain/services/notification.service';

describe('ProjectDistributionService', () => {
  let service: ProjectDistributionService;
  let walletService: jest.Mocked<WalletService>;
  let communityWalletService: jest.Mocked<CommunityWalletService>;
  let communityService: jest.Mocked<CommunityService>;
  let ticketService: jest.Mocked<TicketService>;
  let _userCommunityRoleService: jest.Mocked<UserCommunityRoleService>;

  const projectId = 'proj-1';
  const founderUserId = 'user-founder';

  beforeEach(async () => {
    const mockWalletService = {
      addTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const mockCommunityWalletService = {
      addTotalDistributed: jest.fn().mockResolvedValue(undefined),
      getWallet: jest.fn().mockResolvedValue({ balance: 100, totalDistributed: 0 }),
      debit: jest.fn(),
    };
    const mockCommunityService = {
      getCommunity: jest.fn().mockResolvedValue({
        id: projectId,
        isProject: true,
        founderSharePercent: 15,
        founderUserId,
      }),
    };
    const mockTicketService = {
      getProjectShares: jest.fn(),
    };
    const mockUserCommunityRoleService = {
      getUsersByRole: jest.fn().mockResolvedValue([{ userId: founderUserId }]),
      getTotalFrozenInternalMerits: jest.fn().mockResolvedValue(0),
    };
    const mockNotificationService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectDistributionService,
        { provide: CommunityService, useValue: mockCommunityService },
        { provide: TicketService, useValue: mockTicketService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: CommunityWalletService, useValue: mockCommunityWalletService },
        { provide: UserCommunityRoleService, useValue: mockUserCommunityRoleService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ProjectDistributionService>(ProjectDistributionService);
    walletService = module.get(WalletService) as jest.Mocked<WalletService>;
    communityWalletService = module.get(CommunityWalletService) as jest.Mocked<CommunityWalletService>;
    communityService = module.get(CommunityService) as jest.Mocked<CommunityService>;
    ticketService = module.get(TicketService) as jest.Mocked<TicketService>;
    _userCommunityRoleService = module.get(UserCommunityRoleService) as jest.Mocked<UserCommunityRoleService>;
  });

  describe('distribute', () => {
    it('throws when project not found', async () => {
      communityService.getCommunity.mockResolvedValue(null);
      await expect(service.distribute(projectId, 100)).rejects.toThrow(NotFoundException);
      expect(walletService.addTransaction).not.toHaveBeenCalled();
      expect(communityWalletService.addTotalDistributed).not.toHaveBeenCalled();
    });

    it('throws when not a project', async () => {
      communityService.getCommunity.mockResolvedValue({ id: projectId, isProject: false });
      await expect(service.distribute(projectId, 100)).rejects.toThrow(NotFoundException);
      expect(walletService.addTransaction).not.toHaveBeenCalled();
    });

    it('throws when author share is not positive', async () => {
      await expect(service.distribute(projectId, 0)).rejects.toThrow(BadRequestException);
      await expect(service.distribute(projectId, -1)).rejects.toThrow(BadRequestException);
      expect(walletService.addTransaction).not.toHaveBeenCalled();
    });

    it('when totalInternalMerits=0: all to founder, addTotalDistributed called, balance not touched', async () => {
      ticketService.getProjectShares.mockResolvedValue([]);
      await service.distribute(projectId, 50);

      expect(walletService.addTransaction).toHaveBeenCalledTimes(1);
      expect(walletService.addTransaction).toHaveBeenCalledWith(
        founderUserId,
        expect.any(String),
        'credit',
        50,
        'personal',
        'project_distribution',
        projectId,
        expect.any(Object),
        'Project distribution (no internal merits)',
      );
      expect(communityWalletService.addTotalDistributed).toHaveBeenCalledTimes(1);
      expect(communityWalletService.addTotalDistributed).toHaveBeenCalledWith(projectId, 50);
      expect(communityWalletService.debit).not.toHaveBeenCalled();
    });

    it('when totalInternalMerits>0: formula, rounding, remainder to founder, totalDistributed grows, balance unchanged', async () => {
      ticketService.getProjectShares.mockResolvedValue([
        { userId: founderUserId, internalMerits: 40, sharePercent: 40 },
        { userId: 'user-b', internalMerits: 35, sharePercent: 35 },
        { userId: 'user-c', internalMerits: 25, sharePercent: 25 },
      ]);
      communityService.getCommunity.mockResolvedValue({
        id: projectId,
        isProject: true,
        founderSharePercent: 15,
        founderUserId,
      });

      await service.distribute(projectId, 100);

      expect(communityWalletService.addTotalDistributed).toHaveBeenCalledWith(projectId, 100);
      expect(communityWalletService.debit).not.toHaveBeenCalled();

      const calls = (walletService.addTransaction as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);

      const credits = calls
        .filter((c: unknown[]) => c[2] === 'credit')
        .map((c: unknown[]) => ({ userId: c[0], amount: c[3] }));
      const totalCredited = credits.reduce((s: number, c: { amount: number }) => s + c.amount, 0);
      expect(totalCredited).toBe(100);

      const founderCredits = credits.filter((c: { userId: string }) => c.userId === founderUserId);
      expect(founderCredits.length).toBe(1);
      const founderAmount = founderCredits[0].amount;
      expect(founderAmount).toBeGreaterThanOrEqual(15);
      expect(founderAmount).toBeLessThanOrEqual(100);
    });

    it('when totalInternalMerits>0: remainder goes to founder (no loss)', async () => {
      ticketService.getProjectShares.mockResolvedValue([
        { userId: founderUserId, internalMerits: 1, sharePercent: 50 },
        { userId: 'user-b', internalMerits: 1, sharePercent: 50 },
      ]);
      communityService.getCommunity.mockResolvedValue({
        id: projectId,
        isProject: true,
        founderSharePercent: 10,
        founderUserId,
      });

      await service.distribute(projectId, 10);

      const calls = (walletService.addTransaction as jest.Mock).mock.calls;
      const totalCredited = calls
        .filter((c: unknown[]) => c[2] === 'credit')
        .reduce((s: number, c: unknown[]) => s + (c[3] as number), 0);
      expect(totalCredited).toBe(10);
      expect(communityWalletService.addTotalDistributed).toHaveBeenCalledWith(projectId, 10);
    });
  });
});
