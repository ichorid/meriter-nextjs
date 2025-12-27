import { TestSetupHelper } from './helpers/test-setup.helper';
import { createTestPublication } from './helpers/fixtures';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { uid } from 'uid';
import { CommunitySchemaClass, CommunityDocument } from '../src/domain/models/community/community.schema';
import { UserSchemaClass, UserDocument } from '../src/domain/models/user/user.schema';
import { WalletSchemaClass, WalletDocument } from '../src/domain/models/wallet/wallet.schema';
import { UserCommunityRoleSchemaClass, UserCommunityRoleDocument } from '../src/domain/models/user-community-role/user-community-role.schema';
import { PublicationService } from '../src/domain/services/publication.service';

describe('Publications E2E (happy path)', () => {
  let app: any;
  let testDb: any;
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let walletModel: Model<WalletDocument>;
  let userCommunityRoleModel: Model<UserCommunityRoleDocument>;
  let publicationService: PublicationService;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;

    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    userCommunityRoleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    publicationService = app.get(PublicationService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  it('creates a publication and fetches it', async () => {
    const now = new Date();
    const userId = uid();
    const communityId = uid();

    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Publication User',
      username: `pub_user_${userId}`,
      firstName: 'Pub',
      lastName: 'User',
      avatarUrl: 'https://example.com/u.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    await communityModel.create({
      id: communityId,
      name: 'Publications Community',
      members: [userId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = userId;

    // Minimal DTO aligned with tRPC schema (authorId is ignored by backend; ctx.user is used)
    const dto = createTestPublication(communityId, userId, {});

    // Create publication via tRPC
    const created = await trpcMutation(app, 'publications.create', dto);
    expect(created?.id).toBeDefined();

    // Fetch publication via tRPC
    const fetched = await trpcQuery(app, 'publications.getById', { id: created.id });
    expect(fetched?.id).toEqual(created.id);
  });

  it('filters publications by taxonomy tags using OR logic', async () => {
    const now = new Date();
    const userId = uid();
    const communityId = uid();

    // Setup user
    await userModel.create({
      id: userId,
      telegramId: `user_${userId}`,
      authProvider: 'telegram',
      authId: `user_${userId}`,
      displayName: 'Filter Test User',
      username: `filter_user_${userId}`,
      firstName: 'Filter',
      lastName: 'User',
      avatarUrl: 'https://example.com/u.jpg',
      communityMemberships: [],
      communityTags: [],
      profile: {},
      createdAt: now,
      updatedAt: now,
    });

    // Setup community
    await communityModel.create({
      id: communityId,
      name: 'Filter Test Community',
      members: [userId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 1,
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await userCommunityRoleModel.create({
      id: uid(),
      userId,
      communityId,
      role: 'participant',
      createdAt: now,
      updatedAt: now,
    });

    await walletModel.create({
      id: uid(),
      userId,
      communityId,
      balance: 100,
      currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
    });

    (global as any).testUserId = userId;

    // Create publications with different tag combinations
    // Pub 1: Has "Direct service" method only
    const pub1 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 1 - Direct service only',
      type: 'text',
      postType: 'project',
      isProject: true,
      methods: ['Direct service'],
    });
    const pub1Id = pub1.getId.getValue();

    // Pub 2: Has "Emergency response" method only
    const pub2 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 2 - Emergency response only',
      type: 'text',
      postType: 'project',
      isProject: true,
      methods: ['Emergency response'],
    });
    const pub2Id = pub2.getId.getValue();

    // Pub 3: Has both "Direct service" and "Emergency response"
    const pub3 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 3 - Both methods',
      type: 'text',
      postType: 'project',
      isProject: true,
      methods: ['Direct service', 'Emergency response'],
    });
    const pub3Id = pub3.getId.getValue();

    // Pub 4: Has neither (different method)
    const pub4 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 4 - Different method',
      type: 'text',
      postType: 'project',
      isProject: true,
      methods: ['Education & training'],
    });
    const pub4Id = pub4.getId.getValue();

    // Wait a bit for publications to be indexed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test OR filtering: Filter by ["Direct service", "Emergency response"]
    // Should match pub1, pub2, and pub3 (all have at least one of the tags)
    // Should NOT match pub4 (has neither tag)
    const feedWithFilter = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      pageSize: 10,
      methods: ['Direct service', 'Emergency response'],
    });

    const filteredIds = feedWithFilter.data
      .filter((item: any) => item.type === 'publication')
      .map((item: any) => item.id);

    // Should include pub1, pub2, and pub3 (OR logic)
    expect(filteredIds).toContain(pub1Id);
    expect(filteredIds).toContain(pub2Id);
    expect(filteredIds).toContain(pub3Id);
    // Should NOT include pub4
    expect(filteredIds).not.toContain(pub4Id);

    // Test beneficiaries OR filtering
    // Create publications with different beneficiary combinations
    const pub5 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 5 - Children only',
      type: 'text',
      postType: 'project',
      isProject: true,
      beneficiaries: ['Children & teens'],
    });
    const pub5Id = pub5.getId.getValue();

    const pub6 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 6 - Elderly only',
      type: 'text',
      postType: 'project',
      isProject: true,
      beneficiaries: ['Elderly'],
    });
    const pub6Id = pub6.getId.getValue();

    const pub7 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 7 - Different beneficiary',
      type: 'text',
      postType: 'project',
      isProject: true,
      beneficiaries: ['Low-income families'],
    });
    const pub7Id = pub7.getId.getValue();

    await new Promise(resolve => setTimeout(resolve, 500));

    // Filter by ["Children & teens", "Elderly"] - should match pub5 and pub6 (OR logic)
    const feedWithBeneficiaries = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      pageSize: 10,
      beneficiaries: ['Children & teens', 'Elderly'],
    });

    const filteredBeneficiaryIds = feedWithBeneficiaries.data
      .filter((item: any) => item.type === 'publication')
      .map((item: any) => item.id);

    expect(filteredBeneficiaryIds).toContain(pub5Id);
    expect(filteredBeneficiaryIds).toContain(pub6Id);
    expect(filteredBeneficiaryIds).not.toContain(pub7Id);

    // Test helpNeeded OR filtering
    const pub8 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 8 - Money only',
      type: 'text',
      postType: 'project',
      isProject: true,
      helpNeeded: ['Money'],
    });
    const pub8Id = pub8.getId.getValue();

    const pub9 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 9 - Volunteers only',
      type: 'text',
      postType: 'project',
      isProject: true,
      helpNeeded: ['Volunteers (time)'],
    });
    const pub9Id = pub9.getId.getValue();

    const pub10 = await publicationService.createPublication(userId, {
      communityId,
      content: 'Publication 10 - Different help',
      type: 'text',
      postType: 'project',
      isProject: true,
      helpNeeded: ['Expertise'],
    });
    const pub10Id = pub10.getId.getValue();

    await new Promise(resolve => setTimeout(resolve, 500));

    // Filter by ["Money", "Volunteers (time)"] - should match pub8 and pub9 (OR logic)
    const feedWithHelpNeeded = await trpcQuery(app, 'communities.getFeed', {
      communityId,
      pageSize: 10,
      helpNeeded: ['Money', 'Volunteers (time)'],
    });

    const filteredHelpNeededIds = feedWithHelpNeeded.data
      .filter((item: any) => item.type === 'publication')
      .map((item: any) => item.id);

    expect(filteredHelpNeededIds).toContain(pub8Id);
    expect(filteredHelpNeededIds).toContain(pub9Id);
    expect(filteredHelpNeededIds).not.toContain(pub10Id);
  });
});


