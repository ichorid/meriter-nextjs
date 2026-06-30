import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WalletContextResolverService } from '../src/domain/services/wallet-context-resolver.service';
import { CommunityService } from '../src/domain/services/community.service';
import { MeritResolverService } from '../src/domain/services/merit-resolver.service';
import { CommunityWalletService } from '../src/domain/services/community-wallet.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('WalletContextResolverService', () => {
  let service: WalletContextResolverService;
  let communityService: jest.Mocked<
    Pick<
      CommunityService,
      'getCommunity' | 'listChildProjects'
    >
  >;
  let communityWalletService: jest.Mocked<
    Pick<CommunityWalletService, 'getBalance'>
  >;
  let walletService: jest.Mocked<Pick<WalletService, 'hasPositiveBalanceForCommunity'>>;

  const parentTeam = {
    id: 'parent-id',
    typeTag: 'team',
    isProject: false,
    settings: { sharedWalletWithProjects: true },
  };

  const childProject = {
    id: 'project-id',
    typeTag: 'project',
    isProject: true,
    parentCommunityId: 'parent-id',
    settings: {},
  };

  const localTeam = {
    id: 'team-id',
    typeTag: 'team',
    isProject: false,
    settings: { sharedWalletWithProjects: false },
  };

  beforeEach(async () => {
    communityService = {
      getCommunity: jest.fn(),
      listChildProjects: jest.fn(),
    };
    communityWalletService = {
      getBalance: jest.fn(),
    };
    walletService = {
      hasPositiveBalanceForCommunity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletContextResolverService,
        MeritResolverService,
        { provide: CommunityService, useValue: communityService },
        { provide: CommunityWalletService, useValue: communityWalletService },
        { provide: WalletService, useValue: walletService },
      ],
    }).compile();

    service = module.get(WalletContextResolverService);
  });

  describe('resolveSharedWalletRootId', () => {
    it('returns parent id for child project under shared parent', async () => {
      communityService.getCommunity.mockImplementation(async (id: string) => {
        if (id === 'project-id') return childProject as never;
        if (id === 'parent-id') return parentTeam as never;
        return null;
      });

      await expect(service.resolveSharedWalletRootId('project-id')).resolves.toBe(
        'parent-id',
      );
    });

    it('returns parent id for shared parent community itself', async () => {
      communityService.getCommunity.mockResolvedValue(parentTeam as never);

      await expect(service.resolveSharedWalletRootId('parent-id')).resolves.toBe(
        'parent-id',
      );
    });

    it('returns null when shared wallet is disabled', async () => {
      communityService.getCommunity.mockResolvedValue(localTeam as never);

      await expect(service.resolveSharedWalletRootId('team-id')).resolves.toBeNull();
    });
  });

  describe('resolvePersonalWalletCommunityId', () => {
    it('always returns global for fee', async () => {
      await expect(
        service.resolvePersonalWalletCommunityId(childProject, 'fee'),
      ).resolves.toBe(GLOBAL_COMMUNITY_ID);
    });

    it('returns parent id for voting in shared child project', async () => {
      communityService.getCommunity.mockImplementation(async (id: string) => {
        if (id === 'project-id') return childProject as never;
        if (id === 'parent-id') return parentTeam as never;
        return null;
      });

      await expect(
        service.resolvePersonalWalletCommunityId(childProject, 'voting'),
      ).resolves.toBe('parent-id');
    });

    it('returns community id for local team when not shared', async () => {
      communityService.getCommunity.mockResolvedValue(localTeam as never);

      await expect(
        service.resolvePersonalWalletCommunityId(localTeam, 'voting'),
      ).resolves.toBe('team-id');
    });

    it('returns parent id for withdrawal in shared group', async () => {
      communityService.getCommunity.mockImplementation(async (id: string) => {
        if (id === 'project-id') return childProject as never;
        if (id === 'parent-id') return parentTeam as never;
        return null;
      });

      await expect(
        service.resolvePersonalWalletCommunityId(childProject, 'withdrawal'),
      ).resolves.toBe('parent-id');
    });
  });

  describe('resolveCommunityWalletCommunityId', () => {
    it('returns parent id for project under shared parent', async () => {
      communityService.getCommunity.mockImplementation(async (id: string) => {
        if (id === 'project-id') return childProject as never;
        if (id === 'parent-id') return parentTeam as never;
        return null;
      });

      await expect(
        service.resolveCommunityWalletCommunityId('project-id'),
      ).resolves.toBe('parent-id');
    });
  });

  describe('assertCanEnableSharedWallet', () => {
    it('rejects when child project has community wallet balance', async () => {
      communityService.getCommunity.mockResolvedValue(parentTeam as never);
      communityService.listChildProjects.mockResolvedValue([
        { id: 'p1', name: 'P1' } as never,
      ]);
      communityWalletService.getBalance.mockResolvedValue(5);
      walletService.hasPositiveBalanceForCommunity.mockResolvedValue(false);

      await expect(service.assertCanEnableSharedWallet('parent-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when child project has user wallet balance', async () => {
      communityService.getCommunity.mockResolvedValue(parentTeam as never);
      communityService.listChildProjects.mockResolvedValue([
        { id: 'p1', name: 'P1' } as never,
      ]);
      communityWalletService.getBalance.mockResolvedValue(0);
      walletService.hasPositiveBalanceForCommunity.mockResolvedValue(true);

      await expect(service.assertCanEnableSharedWallet('parent-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('passes when all child balances are zero', async () => {
      communityService.getCommunity.mockResolvedValue(parentTeam as never);
      communityService.listChildProjects.mockResolvedValue([]);
      communityWalletService.getBalance.mockResolvedValue(0);
      walletService.hasPositiveBalanceForCommunity.mockResolvedValue(false);

      await expect(
        service.assertCanEnableSharedWallet('parent-id'),
      ).resolves.toBeUndefined();
    });
  });
});
