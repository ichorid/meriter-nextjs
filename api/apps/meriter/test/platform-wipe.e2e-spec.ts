import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../src/domain/models/publication/publication.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';
import { PLATFORM_WIPE_SUPERADMIN } from '../src/domain/common/constants/platform-bootstrap.constants';
import { PlatformWipeService } from '../src/domain/services/platform-wipe.service';
import { PlatformSettingsService } from '../src/domain/services/platform-settings.service';

describe('PlatformWipeService (e2e)', () => {
  jest.setTimeout(90000);

  let app: INestApplication;
  let testDb: { stop: () => Promise<void> };
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let publicationModel: Model<PublicationDocument>;
  let platformWipeService: PlatformWipeService;
  let platformSettingsService: PlatformSettingsService;

  beforeAll(async () => {
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;
    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    publicationModel = app.get(getModelToken(PublicationSchemaClass.name));
    platformWipeService = app.get(PlatformWipeService);
    platformSettingsService = app.get(PlatformSettingsService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('removes all users and content; recreates bootstrap superadmin; keeps hubs', async () => {
    const now = new Date();

    const regularId = uid();
    await userModel.create({
      id: regularId,
      authProvider: 'fake',
      authId: `wipe_user_${regularId}`,
      displayName: 'Regular',
      username: `wipe_user_${regularId}`,
      firstName: 'Reg',
      lastName: 'User',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    const extraTeamId = uid();
    await communityModel.create({
      id: extraTeamId,
      name: 'Extra team for wipe test',
      typeTag: 'team',
      members: [regularId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
      },
      hashtags: [],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const fv = await communityModel.findOne({ typeTag: 'future-vision' }).lean();
    expect(fv).toBeTruthy();
    const pubId = uid();
    await publicationModel.create({
      id: pubId,
      communityId: fv!.id,
      authorId: regularId,
      content: 'Wipe me',
      type: 'text',
      hashtags: [],
      categories: [],
      images: [],
      metrics: { upvotes: 0, downvotes: 0, score: 0, commentCount: 0 },
      investingEnabled: false,
      investmentPool: 0,
      investmentPoolTotal: 0,
      investments: [],
      status: 'active',
      postType: 'basic',
      isProject: false,
      createdAt: now,
      updatedAt: now,
    });

    const beforeCommunities = await communityModel.countDocuments();
    expect(beforeCommunities).toBeGreaterThanOrEqual(5);

    await communityModel.updateOne(
      { typeTag: 'future-vision' },
      {
        $set: {
          name: 'Custom OB title after admin edit',
          votingSettings: { currencySource: 'wallet-only' as const },
        },
      },
    );

    await platformSettingsService.update({ welcomeMeritsGlobal: 3 });

    const result = await platformWipeService.wipeUserContentAndLocalData();
    expect(result.superadminCount).toBe(1);

    expect(await platformSettingsService.getWelcomeMeritsGlobal()).toBe(100);

    const users = await userModel.find({}).lean();
    expect(users).toHaveLength(1);
    expect(users[0].globalRole).toBe('superadmin');
    expect(users[0].authProvider).toBe('email');
    expect(users[0].authId).toBe(PLATFORM_WIPE_SUPERADMIN.email);
    expect(users[0].displayName).toBe(PLATFORM_WIPE_SUPERADMIN.displayName);
    expect(users[0].profile?.bio).toBe(PLATFORM_WIPE_SUPERADMIN.bio);

    const extraTeam = await communityModel.findOne({ id: extraTeamId }).lean();
    expect(extraTeam).toBeNull();

    const hubs = await communityModel.countDocuments({
      $or: [
        { id: GLOBAL_COMMUNITY_ID },
        { typeTag: { $in: ['future-vision', 'marathon-of-good', 'team-projects', 'support'] } },
      ],
    });
    expect(hubs).toBe(5);

    const totalCommunities = await communityModel.countDocuments();
    expect(totalCommunities).toBe(5);

    const pubs = await publicationModel.countDocuments();
    expect(pubs).toBe(0);

    const fvAfter = await communityModel.findOne({ typeTag: 'future-vision' }).lean();
    expect(fvAfter?.name).toBe('Образы будущего');
    expect(fvAfter?.votingSettings).toBeUndefined();

    const marathonAfter = await communityModel.findOne({ typeTag: 'marathon-of-good' }).lean();
    expect(marathonAfter?.name).toBe('Биржа социальных инвестиций');
    expect(marathonAfter?.settings?.investingEnabled).toBe(true);
    expect(marathonAfter?.tappalkaSettings?.enabled).toBe(true);
    expect(marathonAfter?.tappalkaSettings?.categories?.length).toBe(17);
    expect(marathonAfter?.meritSettings?.quotaEnabled).toBe(true);

    const teamProjectsAfter = await communityModel.findOne({ typeTag: 'team-projects' }).lean();
    expect(teamProjectsAfter?.name).toBe('Проекты');
  });
});
