/**
 * UZZ MVP: bank emission, deal close transfer/hop, demurrage.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { MeriterModule } from '../src/meriter.module';
import { UzzService } from '../src/domain/services/uzz/uzz.service';
import { WalletService } from '../src/domain/services/wallet.service';
import { Model, Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import {
  CommunitySchemaClass,
  CommunityDocument,
} from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../src/domain/models/publication/publication.schema';
import { UzzBankSchemaClass, UzzBankDocument } from '../src/domain/models/uzz/uzz-bank.schema';
import { UzzDealSchemaClass, UzzDealDocument } from '../src/domain/models/uzz/uzz-deal.schema';
import {
  UzzIdentityLinkSchemaClass,
  UzzIdentityLinkDocument,
} from '../src/domain/models/uzz/uzz-identity-link.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { unregisterReplSet } from './mongo-memory-registry.js';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

describe('UzzService (integration)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let uzzService: UzzService;
  let walletService: WalletService;

  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let bankModel: Model<UzzBankDocument>;
  let dealModel: Model<UzzDealDocument>;
  let identityModel: Model<UzzIdentityLinkDocument>;

  let communityId: string;
  let authorId: string;
  let sellerId: string;
  let publicationId: string;

  const currency = { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' } as const;

  beforeAll(async () => {
    communityId = uid();
    authorId = uid();
    sellerId = uid();
    publicationId = uid();

    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'uzz-test' },
    });
    const mongoUri = replSet.getUri();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-uzz';
    process.env.DEFAULT_TELEGRAM_COMMUNITY_ID = communityId;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MeriterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    TestSetupHelper.setupTrpcMiddleware(app);
    await app.init();
    await new Promise((r) => setTimeout(r, 300));

    uzzService = app.get(UzzService);
    walletService = app.get(WalletService);
    connection = app.get(getConnectionToken());
    communityModel = connection.model<CommunityDocument>(CommunitySchemaClass.name);
    userModel = connection.model<UserDocument>(UserSchemaClass.name);
    publicationModel = connection.model<PublicationDocument>(PublicationSchemaClass.name);
    bankModel = connection.model<UzzBankDocument>(UzzBankSchemaClass.name);
    dealModel = connection.model<UzzDealDocument>(UzzDealSchemaClass.name);
    identityModel = connection.model<UzzIdentityLinkDocument>(UzzIdentityLinkSchemaClass.name);

    await communityModel.create({
      id: communityId,
      name: 'UZZ Pilot',
      description: 'test',
      isActive: true,
      typeTag: 'team',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        currencyNames: currency,
        dailyEmission: 10,
        language: 'ru',
        postCost: 1,
        pollCost: 1,
        forwardCost: 1,
      },
    });

    for (const id of [authorId, sellerId]) {
      await userModel.create({
        id,
        authProvider: 'fake',
        authId: `uzz-${id}`,
        displayName: `User ${id.slice(0, 6)}`,
        communityMemberships: [communityId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await walletService.createOrGetWallet(id, communityId, currency);
      await walletService.addTransaction(
        id,
        communityId,
        'credit',
        10,
        'personal',
        'test_seed',
        uid(),
        currency,
        'seed',
      );
      await walletService.createOrGetWallet(id, GLOBAL_COMMUNITY_ID, currency);
      await walletService.addTransaction(
        id,
        GLOBAL_COMMUNITY_ID,
        'credit',
        10,
        'personal',
        'test_seed',
        uid(),
        currency,
        'seed',
      );
    }

    await publicationModel.create({
      id: publicationId,
      communityId,
      authorId,
      content: 'Good deed',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await identityModel.create({
      userId: authorId,
      telegramUserId: '111',
      email: 'author@example.com',
    });
    await identityModel.create({
      userId: sellerId,
      telegramUserId: '222',
      email: 'seller@example.com',
    });
  });

  afterAll(async () => {
    await app?.close();
    if (replSet) {
      unregisterReplSet(replSet);
      await replSet.stop();
    }
  });

  it('emits a bank when publication score reaches threshold', async () => {
    const bank = await uzzService.maybeEmitBankForPublication(publicationId);
    expect(bank).toBeTruthy();
    expect(bank!.status).toBe('awaiting_nominal');
    expect(bank!.ownerId).toBe(authorId);
    expect(bank!.hopsLeft).toBe(10);

    const again = await uzzService.maybeEmitBankForPublication(publicationId);
    expect(again!.id).toBe(bank!.id);
  });

  it('closes a deal: transfers bank, decrements hop, records deal amount', async () => {
    const bank = await bankModel.findOne({ sourcePublicationId: publicationId }).exec();
    expect(bank).toBeTruthy();
    await uzzService.setBankNominal(bank!.id, 1000, authorId);

    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Help with homework',
      description: '1 hour',
      priceRub: 500,
    });

    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    const listed = await uzzService.listDeals(communityId, sellerId);
    const view = listed.find((row) => row.id === deal.id);
    expect(view?.expiresAt).toBeInstanceOf(Date);
    expect(view?.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(view?.feeSource).toBe('community');
    await uzzService.acceptDeal(deal.id, sellerId);
    await uzzService.completeDeal(deal.id, sellerId);
    const closed = await uzzService.closeDeal(deal.id, authorId);

    expect(closed.status).toBe('closed');
    expect(closed.dealAmountRub).toBe(1000);
    const afterClose = await uzzService.getFeeBalances(authorId, communityId);
    expect(afterClose.localBalance).toBe(9);
    expect(afterClose.globalBalance).toBe(10);

    const updatedBank = await bankModel.findOne({ id: bank!.id }).exec();
    expect(updatedBank!.ownerId).toBe(sellerId);
    expect(updatedBank!.hopsLeft).toBe(9);
    expect(updatedBank!.status).toBe('active');
  });

  it('applies demurrage down to floor', async () => {
    const bank = await bankModel.findOne({ sourcePublicationId: publicationId }).exec();
    expect(bank).toBeTruthy();
    bank!.lastDemurrageAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    bank!.nominalRub = 250;
    bank!.status = 'active';
    await bank!.save();

    const result = await uzzService.applyDemurrage();
    expect(result.updated).toBeGreaterThanOrEqual(1);

    const after = await bankModel.findOne({ id: bank!.id }).exec();
    expect(after!.nominalRub).toBe(150);
  });

  it('reserves 1 merit on request and refunds on reject', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for reject',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 800, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Reject lot',
      description: '',
      priceRub: 200,
    });
    const before = await uzzService.getSpendableBalance(authorId, communityId);
    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    expect(deal.feeReserved).toBe(true);
    expect(deal.feeWalletCommunityId).toBe(communityId);
    expect(await uzzService.getSpendableBalance(authorId, communityId)).toBe(before - 1);

    await uzzService.rejectDeal(deal.id, sellerId);
    expect(await uzzService.getSpendableBalance(authorId, communityId)).toBe(before);
  });

  it('expires unanswered requests after TTL', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for ttl',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 700, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'TTL lot',
      description: '',
      priceRub: 100,
    });
    const before = await uzzService.getSpendableBalance(authorId, communityId);
    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    await dealModel.updateOne(
      { id: deal.id },
      { $set: { requestedAt: new Date(Date.now() - 50 * 60 * 60 * 1000) } },
    );

    const result = await uzzService.expireStaleDeals();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const expired = await dealModel.findOne({ id: deal.id }).exec();
    expect(expired!.status).toBe('cancelled');
    expect(await uzzService.getSpendableBalance(authorId, communityId)).toBe(before);

    const freed = await bankModel.findOne({ id: bank!.id }).exec();
    expect(freed!.status).toBe('active');
  });

  it('does not demurrage from emission createdAt before nominal is set', async () => {
    const bank = await bankModel.create({
      id: uid(),
      communityId,
      ownerId: authorId,
      sourcePublicationId: uid(),
      hopsLeft: 10,
      nominalRub: 500,
      status: 'active',
      ownerHistory: [],
    });
    bank.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await bank.save();

    await uzzService.applyDemurrage();
    const after = await bankModel.findOne({ id: bank.id }).exec();
    expect(after!.nominalRub).toBe(500);
    expect(after!.status).toBe('active');
  });

  it('keeps an active bank at the nominal floor while hops remain', async () => {
    const bank = await bankModel.create({
      id: uid(),
      communityId,
      ownerId: authorId,
      sourcePublicationId: uid(),
      hopsLeft: 8,
      nominalRub: 100,
      status: 'active',
      ownerHistory: [],
      lastDemurrageAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    await uzzService.applyDemurrage();
    const after = await bankModel.findOne({ id: bank.id }).exec();
    expect(after!.nominalRub).toBe(100);
    expect(after!.status).toBe('active');
  });

  it('rejects a second open deal on the same bank', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for unique deal',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 900, authorId);
    const lotA = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Lot A',
      description: '',
      priceRub: 100,
    });
    const lotB = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Lot B',
      description: '',
      priceRub: 100,
    });
    const results = await Promise.allSettled([
      uzzService.requestDeal({
        communityId,
        buyerId: authorId,
        lotId: lotA.id,
        bankId: bank!.id,
      }),
      uzzService.requestDeal({
        communityId,
        buyerId: authorId,
        lotId: lotB.id,
        bankId: bank!.id,
      }),
    ]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
  });

  it('does not let the buyer cancel after the seller accepted', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for cancel lock',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 600, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Cancel lock',
      description: '',
      priceRub: 100,
    });
    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    await uzzService.acceptDeal(deal.id, sellerId);
    await expect(uzzService.cancelDeal(deal.id, authorId)).rejects.toThrow(
      /администратор/,
    );
  });

  it('catches up missed demurrage days', async () => {
    const bank = await bankModel.create({
      id: uid(),
      communityId,
      ownerId: authorId,
      sourcePublicationId: uid(),
      hopsLeft: 8,
      nominalRub: 400,
      status: 'active',
      ownerHistory: [],
      lastDemurrageAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
    });
    await uzzService.applyDemurrage();
    const after = await bankModel.findOne({ id: bank.id }).exec();
    expect(after!.nominalRub).toBe(200);
  });

  it('marks an email-login user linked after Telegram confirm', async () => {
    const siteId = uid();
    await userModel.create({
      id: siteId,
      authProvider: 'email',
      authId: 'site-first@example.com',
      displayName: 'Site First',
      communityMemberships: [communityId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const before = await uzzService.getLinkStatus(siteId);
    expect(before.linked).toBe(false);
    expect(before.email).toBe('site-first@example.com');

    const { code } = await uzzService.startTelegramLink(siteId);
    await uzzService.confirmTelegramLink(code, '555001');
    const after = await uzzService.getLinkStatus(siteId);
    expect(after.linked).toBe(true);
    expect(after.telegramUserId).toBe('555001');
  });

  it('resolves a split telegram identity by the site email', async () => {
    const siteId = uid();
    const tgId = uid();
    await userModel.create({
      id: siteId,
      authProvider: 'email',
      authId: 'shared-link@example.com',
      displayName: 'Site Twin',
      communityMemberships: [communityId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await userModel.create({
      id: tgId,
      authProvider: 'telegram',
      authId: '777001',
      displayName: 'TG Twin',
      communityMemberships: [communityId],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await identityModel.create({
      userId: tgId,
      telegramUserId: '777001',
      email: 'shared-link@example.com',
    });

    const status = await uzzService.getLinkStatus(siteId);
    expect(status.linked).toBe(true);
    expect(status.telegramUserId).toBe('777001');

    const lot = await uzzService.createLot({
      communityId,
      authorId: tgId,
      title: 'Linked lot',
      description: '',
      priceRub: 150,
    });
    const updated = await uzzService.updateLot(lot.id, siteId, { title: 'Edited from email' });
    expect(updated.title).toBe('Edited from email');
  });

  it('does not expire a deal after the seller marked it done', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for done TTL',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 500, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Done TTL',
      description: '',
      priceRub: 100,
    });
    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    await uzzService.acceptDeal(deal.id, sellerId);
    await uzzService.completeDeal(deal.id, sellerId);
    await dealModel.updateOne(
      { id: deal.id },
      { $set: { acceptedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } },
    );

    await uzzService.expireStaleDeals();
    const still = await dealModel.findOne({ id: deal.id }).exec();
    expect(still!.status).toBe('completed_by_seller');
    const listed = await uzzService.listDeals(communityId, authorId);
    expect(listed.find((row) => row.id === deal.id)?.expiresAt).toBeNull();
  });

  it('takes the deal fee from the community wallet first', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for local fee',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 500, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Local fee lot',
      description: '',
      priceRub: 100,
    });
    const before = await uzzService.getFeeBalances(authorId, communityId);
    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    expect(deal.feeWalletCommunityId).toBe(communityId);
    const after = await uzzService.getFeeBalances(authorId, communityId);
    expect(after.localBalance).toBe(before.localBalance - 1);
    expect(after.globalBalance).toBe(before.globalBalance);
  });

  it('falls back to the global wallet when the community wallet cannot cover the fee', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for global fee fallback',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 500, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Global fee fallback lot',
      description: '',
      priceRub: 100,
    });
    const before = await uzzService.getFeeBalances(authorId, communityId);
    expect(before.localBalance).toBeGreaterThan(0);
    const drained = await walletService.debitIfSufficient(
      authorId,
      communityId,
      before.localBalance,
      'test_drain',
      uid(),
      'drain local for fee fallback',
    );
    expect(drained).toBe(true);

    const deal = await uzzService.requestDeal({
      communityId,
      buyerId: authorId,
      lotId: lot.id,
      bankId: bank!.id,
    });
    expect(deal.feeWalletCommunityId).toBe(GLOBAL_COMMUNITY_ID);
    const after = await uzzService.getFeeBalances(authorId, communityId);
    expect(after.localBalance).toBe(0);
    expect(after.globalBalance).toBe(before.globalBalance - 1);

    await walletService.addTransaction(
      authorId,
      communityId,
      'credit',
      before.localBalance,
      'personal',
      'test_restore',
      uid(),
      currency,
      'restore local after fee fallback',
    );
  });

  it('rejects the deal when neither wallet can cover the fee', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for empty wallets',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await uzzService.setBankNominal(bank!.id, 500, authorId);
    const lot = await uzzService.createLot({
      communityId,
      authorId: sellerId,
      title: 'Empty wallets lot',
      description: '',
      priceRub: 100,
    });
    const before = await uzzService.getFeeBalances(authorId, communityId);
    if (before.localBalance > 0) {
      expect(
        await walletService.debitIfSufficient(
          authorId,
          communityId,
          before.localBalance,
          'test_drain',
          uid(),
          'drain local',
        ),
      ).toBe(true);
    }
    if (before.globalBalance > 0) {
      expect(
        await walletService.debitIfSufficient(
          authorId,
          GLOBAL_COMMUNITY_ID,
          before.globalBalance,
          'test_drain',
          uid(),
          'drain global',
        ),
      ).toBe(true);
    }

    await expect(
      uzzService.requestDeal({
        communityId,
        buyerId: authorId,
        lotId: lot.id,
        bankId: bank!.id,
      }),
    ).rejects.toThrow(/ни в сообществе, ни в общем кошельке/);

    if (before.localBalance > 0) {
      await walletService.addTransaction(
        authorId,
        communityId,
        'credit',
        before.localBalance,
        'personal',
        'test_restore',
        uid(),
        currency,
        'restore local',
      );
    }
    if (before.globalBalance > 0) {
      await walletService.addTransaction(
        authorId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        before.globalBalance,
        'personal',
        'test_restore',
        uid(),
        currency,
        'restore global',
      );
    }
  });

  it('rejects a nominal below the floor', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Deed for floor',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    await expect(uzzService.setBankNominal(bank!.id, 50, authorId)).rejects.toThrow(
      /не ниже/,
    );
  });

  it('does not emit a bank outside the configured telegram community', async () => {
    const otherId = uid();
    await communityModel.create({
      id: otherId,
      name: 'Other',
      description: 'test',
      isActive: true,
      typeTag: 'team',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        currencyNames: currency,
        dailyEmission: 10,
        language: 'ru',
        postCost: 1,
        pollCost: 1,
        forwardCost: 1,
      },
    });
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId: otherId,
      authorId,
      content: 'Other community deed',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await uzzService.maybeEmitBankForPublication(pubId)).toBeNull();
  });

  it('does not emit a bank for a poll', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Poll not a deed',
      type: 'text',
      postType: 'poll',
      metrics: { upvotes: 0, downvotes: 0, score: 10, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await uzzService.maybeEmitBankForPublication(pubId)).toBeNull();
  });

  it('uses publication content as the deed title when title is empty', async () => {
    const deeds = await uzzService.listDeeds(authorId, communityId);
    const row = deeds.find((d) => d.publicationId === publicationId);
    expect(row?.title).toBe('Good deed');
  });

  it('shows deed text and score on banks awaiting a nominal', async () => {
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId,
      authorId,
      content: 'Helped a neighbour',
      type: 'text',
      postType: 'basic',
      metrics: { upvotes: 0, downvotes: 0, score: 12, commentCount: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const bank = await uzzService.maybeEmitBankForPublication(pubId);
    const views = await uzzService.adminListAwaitingNominal(communityId);
    const row = views.find((b) => b.id === bank!.id);
    expect(row?.sourceTitle).toBe('Helped a neighbour');
    expect(row?.sourceScore).toBe(12);
  });

  it('locks email OTP after too many wrong codes', async () => {
    const { code } = await uzzService.startEmailLinkFromBot(authorId, 'otp@example.com');
    for (let i = 0; i < 4; i += 1) {
      await expect(uzzService.confirmEmailLink(authorId, '000000')).rejects.toThrow(/Неверный код/);
    }
    await expect(uzzService.confirmEmailLink(authorId, '000000')).rejects.toThrow(
      /Слишком много попыток/,
    );
    await expect(uzzService.confirmEmailLink(authorId, code)).rejects.toThrow(
      /новый код/,
    );
  });

  it('rejects email link when the address already belongs to another user', async () => {
    const { code } = await uzzService.startEmailLinkFromBot(authorId, 'seller@example.com');
    await expect(uzzService.confirmEmailLink(authorId, code)).rejects.toThrow(/уже привязана/);
  });
});
