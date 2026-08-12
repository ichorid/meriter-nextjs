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
import {
  UzzIdentityLinkSchemaClass,
  UzzIdentityLinkDocument,
} from '../src/domain/models/uzz/uzz-identity-link.schema';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { unregisterReplSet } from './mongo-memory-registry.js';

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
  let identityModel: Model<UzzIdentityLinkDocument>;

  let communityId: string;
  let authorId: string;
  let sellerId: string;
  let publicationId: string;

  const currency = { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' } as const;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry({
      replSet: { count: 1, dbName: 'uzz-test' },
    });
    const mongoUri = replSet.getUri();
    process.env.MONGO_URL = mongoUri;
    process.env.MONGO_URL_SECONDARY = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-uzz';

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
    identityModel = connection.model<UzzIdentityLinkDocument>(UzzIdentityLinkSchemaClass.name);

    communityId = uid();
    authorId = uid();
    sellerId = uid();
    publicationId = uid();

    await communityModel.create({
      id: communityId,
      name: 'UZZ Pilot',
      description: 'test',
      isActive: true,
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
    await uzzService.acceptDeal(deal.id, sellerId);
    await uzzService.completeDeal(deal.id, sellerId);
    const closed = await uzzService.closeDeal(deal.id, authorId);

    expect(closed.status).toBe('closed');
    expect(closed.dealAmountRub).toBe(1000);

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
});
