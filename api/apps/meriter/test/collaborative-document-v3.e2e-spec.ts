/**
 * Collaborative document v3 E2E: append without official mutation, voting-thread merge, parallel threads.
 */
import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcQuery } from './helpers/trpc-test-helper';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { uid } from 'uid';
import {
  CommunitySchemaClass,
  type CommunityDocument,
} from '../src/domain/models/community/community.schema';
import {
  UserSchemaClass,
  type UserDocument,
} from '../src/domain/models/user/user.schema';
import {
  UserCommunityRoleSchemaClass,
  type UserCommunityRoleDocument,
} from '../src/domain/models/user-community-role/user-community-role.schema';
import {
  WalletSchemaClass,
  type WalletDocument,
} from '../src/domain/models/wallet/wallet.schema';
import {
  MeriterDocumentSchemaClass,
  type MeriterDocumentDocument,
} from '../src/domain/models/meriter-document/meriter-document.schema';
import { GLOBAL_COMMUNITY_ID } from '../src/domain/common/constants/global.constant';

jest.setTimeout(120000);

describe('Collaborative document v3 E2E', () => {
  let app: Awaited<ReturnType<typeof TestSetupHelper.createTestApp>>['app'];
  let testDb: Awaited<ReturnType<typeof TestSetupHelper.createTestApp>>['testDb'];
  let communityModel: Model<CommunityDocument>;
  let userModel: Model<UserDocument>;
  let roleModel: Model<UserCommunityRoleDocument>;
  let walletModel: Model<WalletDocument>;
  let documentModel: Model<MeriterDocumentDocument>;

  const leadId = uid();
  const aliceId = uid();
  const bobId = uid();

  beforeAll(async () => {
    const ctx = await TestSetupHelper.createTestApp();
    app = ctx.app;
    testDb = ctx.testDb;
    communityModel = app.get(getModelToken(CommunitySchemaClass.name));
    userModel = app.get(getModelToken(UserSchemaClass.name));
    roleModel = app.get(getModelToken(UserCommunityRoleSchemaClass.name));
    walletModel = app.get(getModelToken(WalletSchemaClass.name));
    documentModel = app.get(getModelToken(MeriterDocumentSchemaClass.name));

    const now = new Date();
    for (const u of [
      { id: leadId, name: 'Lead' },
      { id: aliceId, name: 'Alice' },
      { id: bobId, name: 'Bob' },
    ]) {
      await userModel.create({
        id: u.id,
        telegramId: `tg_${u.id}`,
        authProvider: 'telegram',
        authId: `tg_${u.id}`,
        displayName: u.name,
        username: u.id.slice(0, 8),
        firstName: u.name,
        lastName: 'Test',
        communityMemberships: [],
        communityTags: [],
        profile: {},
        createdAt: now,
        updatedAt: now,
      });
      await walletModel.create({
        id: uid(),
        userId: u.id,
        communityId: GLOBAL_COMMUNITY_ID,
        balance: 500,
        currency: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  afterEach(() => {
    delete (global as { testUserId?: string }).testUserId;
  });

  async function seedDocumentWithBlocks(
    paragraphs: string[],
  ): Promise<{ communityId: string; documentId: string; blockIds: string[] }> {
    const now = new Date();
    const communityId = uid();
    const documentId = uid();
    const sectionId = uid();
    const blockIds = paragraphs.map(() => uid());

    await communityModel.create({
      id: communityId,
      name: 'Doc v3 test community',
      members: [leadId, aliceId, bobId],
      settings: {
        currencyNames: { singular: 'merit', plural: 'merits', genitive: 'merits' },
        dailyEmission: 10,
        postCost: 0,
        documentsMode: 'all',
        documentCreators: 'members',
      },
      hashtags: ['test'],
      hashtagDescriptions: {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await roleModel.create([
      { id: uid(), userId: leadId, communityId, role: 'lead', createdAt: now, updatedAt: now },
      {
        id: uid(),
        userId: aliceId,
        communityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        userId: bobId,
        communityId,
        role: 'participant',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await documentModel.create({
      id: documentId,
      communityId,
      type: 'custom',
      title: 'V3 test doc',
      createdBy: leadId,
      status: 'active',
      mode: 'manual',
      deleted: false,
      variantCost: 0,
      votingDurationHours: 24,
      sections: [
        {
          id: sectionId,
          title: '',
          order: 0,
          blocks: paragraphs.map((html, order) => ({
            id: blockIds[order]!,
            order,
            blockType: 'paragraph',
            officialContent: html,
            proposalsLocked: false,
            lockedRanges: [],
            officialRating: 0,
            editHistory: [],
          })),
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    return { communityId, documentId, blockIds };
  }

  function blockCount(doc: { sections?: Array<{ blocks?: unknown[] }> }): number {
    return (doc.sections ?? []).reduce((n, s) => n + (s.blocks?.length ?? 0), 0);
  }

  it('append at end does not mutate official until apply', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>One</p>',
      '<p>Two</p>',
    ]);
    const anchorId = blockIds[0]!;

    (global as { testUserId?: string }).testUserId = aliceId;
    const before = await trpcQuery(app, 'documents.getById', { id: documentId });
    expect(blockCount(before)).toBe(2);

    const proposed = '<p>One</p><p>Two</p><p>Three</p><p>Four</p>';
    const proposeResult = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: anchorId,
      content: proposed,
    });
    expect(proposeResult.variant).toBeDefined();
    expect(proposeResult.variant.patches?.[0]?.insertBlocks?.length).toBe(2);
    expect(proposeResult.variant.ops?.length).toBeGreaterThan(0);
    expect(proposeResult.variant.ops?.[0]?.op).toBe('insert_after');

    const afterPropose = await trpcQuery(app, 'documents.getById', { id: documentId });
    expect(blockCount(afterPropose)).toBe(2);

    (global as { testUserId?: string }).testUserId = leadId;
    await trpcMutation(app, 'documentVariants.applyOpenAsAdmin', {
      variantId: proposeResult.variant.id,
    });

    const afterApply = await trpcQuery(app, 'documents.getById', { id: documentId });
    expect(blockCount(afterApply)).toBe(4);
    const joined = (afterApply.sections ?? [])
      .flatMap((s: { blocks: Array<{ officialContent: string }> }) => s.blocks)
      .map((b: { officialContent: string }) => b.officialContent)
      .join('');
    expect(joined).toContain('Three');
    expect(joined).toContain('Four');
  });

  it('overlapping proposals share one voting thread', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>Alpha bravo charlie.</p>',
    ]);
    const block1 = blockIds[0]!;

    (global as { testUserId?: string }).testUserId = aliceId;
    const alice = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: block1,
      content: '<p>Alpha BRAVO charlie.</p>',
    });

    (global as { testUserId?: string }).testUserId = bobId;
    const bob = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: block1,
      content: '<p>Alpha BRAVE charlie.</p>',
    });

    expect(bob.proposeWarning).toBe('merged_into_voting');
    expect(bob.variant.votingThreadId).toBe(alice.variant.votingThreadId);

    const listing = await trpcQuery(app, 'documentVariants.listByDocument', {
      documentId,
    });
    const openVariants = listing.threads.flatMap(
      (t: { variants: Array<{ status: string; votingThreadId?: string }> }) =>
        t.variants.filter((v) => v.status === 'open'),
    );
    expect(openVariants.length).toBe(2);
    expect(new Set(openVariants.map((v) => v.votingThreadId)).size).toBe(1);
  });

  it('non-overlapping proposals get separate voting threads', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>Block one.</p>',
      '<p>Block two.</p>',
    ]);

    (global as { testUserId?: string }).testUserId = aliceId;
    const alice = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: blockIds[0]!,
      content: '<p>Block ONE.</p><p>Block two.</p>',
    });

    (global as { testUserId?: string }).testUserId = bobId;
    const bob = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: blockIds[1]!,
      content: '<p>Block one.</p><p>Block TWO.</p>',
    });

    expect(bob.proposeWarning).toBeUndefined();
    expect(alice.variant.votingThreadId).toBeTruthy();
    expect(bob.variant.votingThreadId).toBeTruthy();
    expect(alice.variant.votingThreadId).not.toBe(bob.variant.votingThreadId);

    const listing = await trpcQuery(app, 'documentVariants.listByDocument', {
      documentId,
    });
    expect(listing.threads.length).toBeGreaterThanOrEqual(2);
  });

  it('propose middle insert yields insert_after patches and full content', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<h2>Heading</h2>',
      '<p>Footer</p>',
    ]);
    const anchorId = blockIds[0]!;
    const proposed =
      '<h2>Heading</h2><p>Inserted A</p><p>Inserted B</p><p>Footer</p>';

    (global as { testUserId?: string }).testUserId = aliceId;
    const result = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: anchorId,
      content: proposed,
    });

    const variant = result.variant;
    expect(variant.proposalScope).toBe('patches');
    const insertPatch = variant.patches?.find(
      (p: { insertBlocks?: unknown[] }) => (p.insertBlocks?.length ?? 0) > 0,
    );
    expect(insertPatch).toBeDefined();
    const insertedHtml = (insertPatch?.insertBlocks ?? [])
      .map((b: { officialContent: string }) => b.officialContent)
      .join('');
    expect(insertedHtml).toContain('Inserted A');
    expect(insertedHtml).toContain('Inserted B');
    expect(variant.content).toContain('Inserted A');
    expect(variant.content).toContain('Inserted B');
    expect(variant.content).toContain('Footer');
  });

  it('propose multi-block delete emits delete patch for removed heading', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>Long paragraph text</p>',
      '<h3>Subheading</h3>',
    ]);

    (global as { testUserId?: string }).testUserId = aliceId;
    const result = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: blockIds[0]!,
      content: '<p>Long paragraph</p>',
    });

    const variant = result.variant;
    expect(variant.proposalScope).toBe('patches');
    const patchBlockIds = (variant.patches ?? []).map(
      (p: { blockId: string }) => p.blockId,
    );
    expect(patchBlockIds).toContain(blockIds[1]!);
    expect(variant.content).not.toContain('Subheading');
  });

  it('close by_votes ends open voting thread before wave expiry', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>Vote target text.</p>',
    ]);
    const block1 = blockIds[0]!;

    (global as { testUserId?: string }).testUserId = aliceId;
    const proposed = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: block1,
      content: '<p>Vote target CHANGED.</p>',
    });
    expect(proposed.variant.status).toBe('open');

    (global as { testUserId?: string }).testUserId = leadId;
    await trpcMutation(app, 'documentVariants.closeVotingWaveOnBlock', {
      documentId,
      blockId: block1,
      resolution: { mode: 'by_votes' },
    });

    const listing = await trpcQuery(app, 'documentVariants.listByDocument', {
      documentId,
    });
    expect(
      listing.threads.every((t: { waveOpen: boolean }) => !t.waveOpen),
    ).toBe(true);

    const refreshed = await trpcQuery(app, 'documentVariants.getBlockVotingPanel', {
      documentId,
      blockId: block1,
    });
    const openVariants = refreshed.variants.filter(
      (v: { status: string }) => v.status === 'open',
    );
    expect(openVariants).toHaveLength(0);
    expect(
      refreshed.variants.some((v: { id: string; status: string }) =>
        v.id === proposed.variant.id &&
        (v.status === 'closed-winner' || v.status === 'closed-not-winner'),
      ),
    ).toBe(true);
  });

  it('after force_official wave close, new propose does not merge into stale thread', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<p>Alpha bravo charlie.</p>',
    ]);
    const block1 = blockIds[0]!;

    (global as { testUserId?: string }).testUserId = aliceId;
    await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: block1,
      content: '<p>Alpha BRAVO charlie.</p>',
    });

    (global as { testUserId?: string }).testUserId = leadId;
    await trpcMutation(app, 'documentVariants.closeVotingWaveOnBlock', {
      documentId,
      blockId: block1,
      resolution: { mode: 'force_official' },
    });

    (global as { testUserId?: string }).testUserId = bobId;
    const afterClose = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: block1,
      content:
        '<p>Alpha bravo charlie.</p><p>Inserted after close</p>',
    });

    expect(afterClose.proposeWarning).toBeUndefined();
    const openThreads = await trpcQuery(app, 'documentVariants.listByDocument', {
      documentId,
    });
    const openCount = openThreads.threads.filter(
      (t: { waveOpen: boolean }) => t.waveOpen,
    ).length;
    expect(openCount).toBeLessThanOrEqual(1);
  });

  it('apply winner applies middle insert_after to official document', async () => {
    const { documentId, blockIds } = await seedDocumentWithBlocks([
      '<h2>Title</h2>',
      '<p>End</p>',
    ]);
    const proposed =
      '<h2>Title</h2><p>Middle A</p><p>Middle B</p><p>End</p>';

    (global as { testUserId?: string }).testUserId = aliceId;
    const proposeResult = await trpcMutation(app, 'documentVariants.propose', {
      documentId,
      blockId: blockIds[0]!,
      content: proposed,
    });

    (global as { testUserId?: string }).testUserId = leadId;
    await trpcMutation(app, 'documentVariants.applyOpenAsAdmin', {
      variantId: proposeResult.variant.id,
    });

    const afterApply = await trpcQuery(app, 'documents.getById', { id: documentId });
    expect(blockCount(afterApply)).toBe(4);
    const joined = (afterApply.sections ?? [])
      .flatMap((s: { blocks: Array<{ officialContent: string }> }) => s.blocks)
      .map((b: { officialContent: string }) => b.officialContent)
      .join('');
    expect(joined).toContain('Middle A');
    expect(joined).toContain('Middle B');
  });
});
