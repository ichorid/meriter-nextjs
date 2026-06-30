import { INestApplication } from '@nestjs/common';
import { Model, Connection } from 'mongoose';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Community, CommunityDocument } from '../src/domain/models/community/community.schema';
import { User, UserDocument } from '../src/domain/models/user/user.schema';
import { Publication, PublicationDocument } from '../src/domain/models/publication/publication.schema';
import { uid } from 'uid';
import type { UserCommunityRoleService } from '../src/domain/services/user-community-role.service';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { TestSetupHelper } from './helpers/test-setup.helper';

describe('Telegram publication moderation (e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication;
  let testDb: Awaited<ReturnType<typeof TestSetupHelper.createTestApp>>['testDb'];
  let connection: Connection;
  let userCommunityRoleService: UserCommunityRoleService;

  let authorId: string;
  let leadId: string;
  let communityId: string;

  beforeAll(async () => {
    process.env.MERITER_PRODUCT_MODE = 'telegram_mvp';
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;
    connection = app.get(getConnectionToken());

    const { UserCommunityRoleService: RoleSvc } = await import(
      '../src/domain/services/user-community-role.service'
    );
    userCommunityRoleService = app.get(RoleSvc);

    app.get<Model<PublicationDocument>>(getModelToken(Publication.name));
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const communityModel = app.get<Model<CommunityDocument>>(
      getModelToken(Community.name),
    );

    authorId = uid();
    leadId = uid();
    communityId = uid();

    await userModel.create([
      {
        id: authorId,
        authProvider: 'telegram',
        authId: `tg_${authorId}`,
        telegramId: `tg_${authorId}`,
        displayName: 'Author',
        username: 'author',
        communityMemberships: [communityId],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: leadId,
        authProvider: 'telegram',
        authId: `tg_${leadId}`,
        telegramId: `tg_${leadId}`,
        displayName: 'Lead',
        username: 'lead',
        communityMemberships: [communityId],
        communityTags: [],
        profile: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await communityModel.create({
      id: communityId,
      name: 'TG Moderation Community',
      typeTag: 'team',
      settings: {
        postCost: 0,
        pollCost: 0,
        dailyEmission: 10,
        telegramModerationEnabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await userCommunityRoleService.setRole(leadId, communityId, 'lead');
    await userCommunityRoleService.setRole(authorId, communityId, 'participant');
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  beforeEach(async () => {
    await connection.collection('publications').deleteMany({});
  });

  it('holds web posts until lead approves, then shows in feed', async () => {
    (global as any).testUserId = authorId;
    (global as any).testUserGlobalRole = undefined;

    const created = await trpcMutation(app, 'publications.create', {
      communityId,
      content: 'Pending moderation post',
      type: 'text',
    });

    expect(created.telegramModerationStatus).toBe('pending');

    const feedBefore = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      page: 1,
      pageSize: 10,
      sort: 'recent',
    });
    const idsBefore = (feedBefore.data ?? []).map((i: { id: string }) => i.id);
    expect(idsBefore).not.toContain(created.id);

    (global as any).testUserId = leadId;
    const pending = await trpcQuery(
      app,
      'publications.listPendingTelegramModeration',
      { communityId },
    );
    expect(pending.map((p: { id: string }) => p.id)).toContain(created.id);

    await trpcMutation(app, 'publications.approveTelegramModeration', {
      publicationId: created.id,
    });

    (global as any).testUserId = authorId;
    const feedAfter = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      page: 1,
      pageSize: 10,
      sort: 'recent',
    });
    const idsAfter = (feedAfter.data ?? []).map((i: { id: string }) => i.id);
    expect(idsAfter).toContain(created.id);
  });

  it('rejects pending post and keeps it out of feed', async () => {
    (global as any).testUserId = authorId;
    (global as any).testUserGlobalRole = undefined;

    const created = await trpcMutation(app, 'publications.create', {
      communityId,
      content: 'Rejected post',
      type: 'text',
    });

    (global as any).testUserId = leadId;
    await trpcMutation(app, 'publications.rejectTelegramModeration', {
      publicationId: created.id,
    });

    (global as any).testUserId = authorId;
    const feed = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      page: 1,
      pageSize: 10,
      sort: 'recent',
    });
    const ids = (feed.data ?? []).map((i: { id: string }) => i.id);
    expect(ids).not.toContain(created.id);
  });
});
