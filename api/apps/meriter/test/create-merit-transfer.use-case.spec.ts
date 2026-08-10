import { CreateMeritTransferUseCase } from '../src/application/use-cases/merit-transfer/create-merit-transfer.use-case';
import type { MeritTransferPersistencePort } from '../src/domain/ports/merit-transfer.persistence.port';
import type { PublicationPersistencePort } from '../src/domain/ports/publication.persistence.port';
import type { CommunityService } from '../src/domain/services/community.service';
import type { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import type { WalletService } from '../src/domain/services/wallet.service';
import type { WalletContextResolverService } from '../src/domain/services/wallet-context-resolver.service';
import { Wallet } from '../src/domain/aggregates/wallet/wallet.entity';
import { UserId, CommunityId } from '../src/domain/value-objects';

describe('CreateMeritTransferUseCase', () => {
  const communityId = 'community-1';
  const senderId = 'sender-1';
  const receiverId = 'receiver-1';
  const currency = { singular: 'merit', plural: 'merits', genitive: 'merits' };

  let meritTransferPersistence: jest.Mocked<
    Pick<MeritTransferPersistencePort, 'runInTransaction' | 'create'>
  >;
  let publicationPersistence: jest.Mocked<Pick<PublicationPersistencePort, 'findById'>>;
  let walletService: jest.Mocked<
    Pick<WalletService, 'getWallet' | 'createOrGetWallet' | 'addTransaction'>
  >;
  let communityService: jest.Mocked<
    Pick<CommunityService, 'getCommunity' | 'startingMeritsOnJoin'>
  >;
  let userCommunityRoleService: jest.Mocked<Pick<UserCommunityRoleService, 'getRole'>>;
  let walletContextResolverService: jest.Mocked<
    Pick<WalletContextResolverService, 'resolvePersonalWalletCommunityId'>
  >;

  beforeEach(() => {
    meritTransferPersistence = {
      runInTransaction: jest.fn(async (fn) => fn(undefined)),
      create: jest.fn().mockResolvedValue({
        id: 'transfer-1',
        senderId,
        receiverId,
        amount: 14,
        sourceWalletType: 'community',
        sourceContextId: communityId,
        targetWalletType: 'community',
        targetContextId: communityId,
        communityContextId: communityId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    publicationPersistence = { findById: jest.fn() };
    walletService = {
      getWallet: jest.fn(),
      createOrGetWallet: jest.fn(),
      addTransaction: jest.fn().mockResolvedValue({} as Wallet),
    };
    communityService = {
      getCommunity: jest.fn().mockResolvedValue({
        id: communityId,
        settings: { currencyNames: currency },
      }),
      startingMeritsOnJoin: jest.fn().mockReturnValue(13),
    };
    userCommunityRoleService = {
      getRole: jest.fn().mockResolvedValue({ userId: senderId, role: 'participant' }),
    };
    walletContextResolverService = {
      resolvePersonalWalletCommunityId: jest.fn().mockResolvedValue(communityId),
    };
  });

  it('ensures receiver wallet with starting merits before crediting transfer', async () => {
    const senderWallet = Wallet.create(
      UserId.fromString(senderId),
      CommunityId.fromString(communityId),
      currency,
    );
    senderWallet.add(100);
    walletService.getWallet.mockResolvedValue(senderWallet);

    const useCase = new CreateMeritTransferUseCase(
      meritTransferPersistence as MeritTransferPersistencePort,
      publicationPersistence as PublicationPersistencePort,
      walletService as WalletService,
      communityService as CommunityService,
      userCommunityRoleService as UserCommunityRoleService,
      walletContextResolverService as WalletContextResolverService,
    );

    await useCase.execute({
      senderId,
      receiverId,
      amount: 14,
      sourceWalletType: 'community',
      sourceContextId: communityId,
      targetWalletType: 'community',
      targetContextId: communityId,
      communityContextId: communityId,
    });

    expect(walletService.createOrGetWallet).toHaveBeenCalledWith(
      receiverId,
      communityId,
      currency,
      { startingMeritsIfNewWallet: 13 },
    );
    expect(walletService.addTransaction).toHaveBeenCalledTimes(2);
  });
});
