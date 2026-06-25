import { INestApplication } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { getConnectionToken } from '@nestjs/mongoose';

import { Connection } from 'mongoose';

import type { MongoMemoryReplSet } from 'mongodb-memory-server';

import { SeedCommunityWebDevUseCase } from '../src/application/use-cases/dev/seed-community-web-dev.use-case';

import { AuthenticateFakeCommunityUseCase } from '../src/application/use-cases/auth/authenticate-fake-community.use-case';

import {

  COMMUNITY_WEB_DEV_COMMUNITY_ID,

  COMMUNITY_WEB_DEV_CONTENT_MARKER,

  COMMUNITY_WEB_DEV_LEAD_USER_ID,

} from '../src/domain/common/constants/community-web-dev.constants';

import { AuthProviderService } from '../src/infrastructure/auth/auth-provider.service';

import { CookieManager } from '../src/infrastructure/auth/cookie-manager';

import { UserService } from '../src/domain/services/user.service';

import { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';

import { WalletService } from '../src/domain/services/wallet.service';

import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';

import { TestSetupHelper } from './helpers/test-setup.helper';



type ReplSetContext = {

  app: INestApplication;

  replSet: MongoMemoryReplSet & { stopAndUnregister?: () => Promise<void> };

};



async function createReplSetTestApp(): Promise<ReplSetContext> {

  process.env.MERITER_PRODUCT_MODE = 'telegram_mvp';

  process.env.FAKE_DATA_MODE = 'true';

  return TestSetupHelper.createTestAppWithReplSet();

}



async function closeReplSetTestApp(ctx: ReplSetContext): Promise<void> {

  if (ctx.app) {

    await ctx.app.close();

  }

  if (ctx.replSet.stopAndUnregister) {

    await ctx.replSet.stopAndUnregister();

  } else {

    await ctx.replSet.stop();

  }

}



describe('Community-web dev seed (e2e)', () => {

  jest.setTimeout(120000);



  let app: INestApplication;

  let replSet: ReplSetContext['replSet'];

  let connection: Connection;



  beforeAll(async () => {

    const ctx = await createReplSetTestApp();

    app = ctx.app;

    replSet = ctx.replSet;

    connection = app.get(getConnectionToken());

  });



  afterAll(async () => {

    await closeReplSetTestApp({ app, replSet });

  });



  it('seeds idempotently: community, roles, wallets, feed, members, merits, poll, votes', async () => {

    const useCase = app.get(SeedCommunityWebDevUseCase);

    const first = await useCase.execute({ explicit: true, ifMissingOnly: false });

    const second = await useCase.execute({ explicit: true, ifMissingOnly: true });



    expect(first.communityId).toBe(COMMUNITY_WEB_DEV_COMMUNITY_ID);

    expect(first.usersEnsured).toBeGreaterThanOrEqual(5);

    expect(first.votesCreated).toBeGreaterThan(0);

    expect(second.skippedContent).toBe(true);



    const scoredPub = await connection.collection('publications').findOne({

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

      content: { $regex: COMMUNITY_WEB_DEV_CONTENT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },

      'metrics.score': { $gt: 0 },

    });

    expect(scoredPub).toBeDefined();



    const community = await connection.collection('communities').findOne({

      id: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    expect(community?.settings?.telegramModerationEnabled).toBe(true);

    expect(community?.telegramChatId).toBe('-1009990000001');



    const leadRole = await connection.collection('user_community_roles').findOne({

      userId: COMMUNITY_WEB_DEV_LEAD_USER_ID,

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    expect(leadRole?.role).toBe('lead');



    const wallet = await connection.collection('wallets').findOne({

      userId: COMMUNITY_WEB_DEV_LEAD_USER_ID,

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    expect(wallet?.balance).toBeGreaterThan(0);



    (global as any).testUserId = COMMUNITY_WEB_DEV_LEAD_USER_ID;



    const members = await trpcQuery(app, 'communities.getMembers', {

      id: COMMUNITY_WEB_DEV_COMMUNITY_ID,

      pageSize: 50,

    });

    expect(members.pagination?.total ?? members.total).toBeGreaterThanOrEqual(5);

    expect(members.data.some((m: { role?: string }) => m.role === 'lead')).toBe(true);

    expect(

      members.data.filter((m: { role?: string }) => m.role === 'participant').length,

    ).toBeGreaterThanOrEqual(4);



    const feed = await trpcQuery(app, 'communities.getFeed', {

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

      page: 1,

      pageSize: 20,

      sort: 'recent',

    });

    const contents = (feed.data ?? []).map((item: { content?: string }) => item.content ?? '');

    expect(contents.some((c: string) => c.includes(COMMUNITY_WEB_DEV_CONTENT_MARKER))).toBe(

      true,

    );



    const pollList = await trpcQuery(app, 'polls.getByCommunity', {

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    const pollRows = Array.isArray(pollList) ? pollList : pollList?.data ?? [];

    const devPoll = pollRows.find((p: { question?: string }) =>

      (p.question ?? '').includes(COMMUNITY_WEB_DEV_CONTENT_MARKER),

    );

    expect(devPoll).toBeDefined();

    expect(first.pollCastsCreated).toBeGreaterThan(0);

    const castCount = await connection.collection('poll_casts').countDocuments({
      pollId: devPoll.id,
    });

    expect(castCount).toBeGreaterThan(0);



    const meritHistory = await trpcQuery(app, 'wallets.getCommunityMeritHistory', {

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

      page: 1,

      pageSize: 50,

    });

    const historyRows = meritHistory?.data ?? [];

    expect(historyRows.length).toBeGreaterThan(1);

    expect(

      historyRows.some(

        (row: { referenceType?: string; meritHistoryCategory?: string }) =>

          row.referenceType === 'merit_transfer' ||

          row.referenceType === 'publication_vote' ||

          row.meritHistoryCategory === 'community_starting_merits',

      ),

    ).toBe(true);

    expect(first.meritTransfersCreated).toBeGreaterThan(0);

  });



  it('forceContent re-seed is idempotent after wipe', async () => {

    const useCase = app.get(SeedCommunityWebDevUseCase);

    const forced = await useCase.execute({

      explicit: true,

      forceContent: true,

      ifMissingOnly: false,

    });

    expect(forced.skippedContent).toBe(false);

    expect(forced.usersEnsured).toBeGreaterThanOrEqual(5);



    const again = await useCase.execute({

      explicit: true,

      forceContent: true,

      ifMissingOnly: false,

    });

    expect(again.skippedContent).toBe(false);

    expect(again.usersEnsured).toBeGreaterThanOrEqual(5);

  });

});



describe('Community-web dev fake auth (e2e)', () => {

  jest.setTimeout(120000);



  let app: INestApplication;

  let replSet: ReplSetContext['replSet'];



  beforeAll(async () => {

    const ctx = await createReplSetTestApp();

    app = ctx.app;

    replSet = ctx.replSet;



    const seedUseCase = app.get(SeedCommunityWebDevUseCase);

    await seedUseCase.execute({ explicit: true, ifMissingOnly: false });

  });



  afterAll(async () => {

    await closeReplSetTestApp({ app, replSet });

  });



  it('authenticateFake lead returns communityId, getMe, and moderation list', async () => {

    const authUseCase = new AuthenticateFakeCommunityUseCase(

      app.get(AuthProviderService),

      app.get(CookieManager),

      app.get(ConfigService),

      app.get(UserService),

      app.get(UserCommunityRoleService),

      app.get(WalletService),

    );



    const response = { cookie: jest.fn() };

    const result = await authUseCase.execute({ persona: 'lead' }, {}, response);

    expect(result.communityId).toBe(COMMUNITY_WEB_DEV_COMMUNITY_ID);



    (global as any).testUserId = COMMUNITY_WEB_DEV_LEAD_USER_ID;

    const me = await trpcQuery(app, 'users.getMe', undefined);

    expect(me.id).toBe(COMMUNITY_WEB_DEV_LEAD_USER_ID);



    const pending = await trpcQuery(app, 'publications.listPendingTelegramModeration', {

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    expect(Array.isArray(pending)).toBe(true);

    expect(pending.length).toBeGreaterThan(0);



    const config = await trpcQuery(app, 'config.getConfig', undefined);

    expect(config.devCommunityId).toBe(COMMUNITY_WEB_DEV_COMMUNITY_ID);

  });



  it('dev.reseedDevData mutation works for lead on dev community', async () => {

    (global as any).testUserId = COMMUNITY_WEB_DEV_LEAD_USER_ID;



    const result = await trpcMutation(app, 'community/dev.reseedDevData', {

      communityId: COMMUNITY_WEB_DEV_COMMUNITY_ID,

    });

    expect(result.communityId).toBe(COMMUNITY_WEB_DEV_COMMUNITY_ID);

    expect(result.usersEnsured).toBeGreaterThanOrEqual(5);

  });

});

