import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../src/domain/services/wallet.service';
import { EventBus } from '../src/domain/events/event-bus';
import {
  WALLET_PERSISTENCE_PORT,
  type WalletPersistencePort,
} from '../src/domain/ports/wallet.persistence.port';
import { Wallet } from '../src/domain/aggregates/wallet/wallet.entity';
import { UserId, CommunityId } from '../src/domain/value-objects';

describe('WalletService.createOrGetWallet', () => {
  let service: WalletService;
  let walletPersistence: jest.Mocked<
    Pick<
      WalletPersistencePort,
      | 'findWalletByUserAndCommunity'
      | 'insertWallet'
      | 'findTransactionByWalletAndReferenceType'
      | 'updateWallet'
      | 'insertTransaction'
    >
  >;
  let eventBus: jest.Mocked<Pick<EventBus, 'publish'>>;

  const currency = { singular: 'merit', plural: 'merits', genitive: 'merits' };
  const userId = 'user-1';
  const communityId = 'community-1';

  beforeEach(async () => {
    walletPersistence = {
      findWalletByUserAndCommunity: jest.fn(),
      insertWallet: jest.fn(),
      findTransactionByWalletAndReferenceType: jest.fn(),
      updateWallet: jest.fn(),
      insertTransaction: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: WALLET_PERSISTENCE_PORT, useValue: walletPersistence },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  it('credits starting merits for an existing wallet that never received them', async () => {
    const existing = Wallet.create(
      UserId.fromString(userId),
      CommunityId.fromString(communityId),
      currency,
    );
    existing.add(14);
    const snapshot = existing.toSnapshot();

    walletPersistence.findWalletByUserAndCommunity.mockResolvedValue(snapshot);
    walletPersistence.findTransactionByWalletAndReferenceType.mockResolvedValue(null);
    walletPersistence.updateWallet.mockImplementation(async (updated) => updated);
    walletPersistence.insertTransaction.mockResolvedValue(undefined);

    const wallet = await service.createOrGetWallet(userId, communityId, currency, {
      startingMeritsIfNewWallet: 13,
    });

    expect(wallet.getBalance()).toBe(27);
    expect(walletPersistence.insertWallet).not.toHaveBeenCalled();
    expect(walletPersistence.findTransactionByWalletAndReferenceType).toHaveBeenCalledWith(
      snapshot.id,
      'community_starting_merits',
    );
    expect(walletPersistence.insertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceType: 'community_starting_merits',
        amount: 13,
      }),
      undefined,
    );
  });

  it('does not duplicate starting merits when community_starting_merits already exists', async () => {
    const existing = Wallet.create(
      UserId.fromString(userId),
      CommunityId.fromString(communityId),
      currency,
    );
    existing.add(14);
    const snapshot = existing.toSnapshot();

    walletPersistence.findWalletByUserAndCommunity.mockResolvedValue(snapshot);
    walletPersistence.findTransactionByWalletAndReferenceType.mockResolvedValue({
      id: 'tx-start',
      walletId: snapshot.id,
      type: 'deposit',
      amount: 13,
      referenceType: 'community_starting_merits',
      referenceId: communityId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const wallet = await service.createOrGetWallet(userId, communityId, currency, {
      startingMeritsIfNewWallet: 13,
    });

    expect(wallet.getBalance()).toBe(14);
    expect(walletPersistence.insertTransaction).not.toHaveBeenCalled();
  });
});
