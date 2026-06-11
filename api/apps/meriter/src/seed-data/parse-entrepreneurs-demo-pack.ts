import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { resolveEntrepreneursDemoPackDir } from './resolve-seed-data-path';

const DemoUserSchema = z.object({
  id: z.string(),
  login: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  username: z.string(),
  role: z.enum(['lead', 'participant']),
  bio: z.string(),
  avatarUrl: z.string().optional().default(''),
});

const DemoCommunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  typeTag: z.literal('team'),
  avatarUrl: z.string().optional().default(''),
  coverImageUrl: z.string().optional().default(''),
  futureVisionCover: z.string().optional().default(''),
  futureVisionText: z.string(),
  settings: z.object({
    sharedWalletWithProjects: z.boolean(),
    allowWithdraw: z.boolean(),
    postCost: z.number(),
    pollCost: z.number(),
    commentMode: z.enum(['all', 'neutralOnly', 'weightedOnly']),
    canPayPostFromQuota: z.boolean().optional(),
    currencyNames: z.object({
      singular: z.string(),
      plural: z.string(),
      genitive: z.string(),
    }),
    dailyEmission: z.number(),
  }),
  meritSettings: z.object({
    quotaEnabled: z.boolean(),
    dailyQuota: z.number(),
    startingMerits: z.number(),
  }),
});

const DemoProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  founderUserKey: z.string(),
  coverImageUrl: z.string().optional().default(''),
});

const DemoManifestSchema = z.object({
  packId: z.literal('entrepreneurs'),
  version: z.number().int().positive(),
  communityId: z.string(),
  demoPersonaAuthIds: z.array(z.string()),
});

const TimelinePollOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const TimelinePollCastSchema = z.object({
  userKey: z.string(),
  optionId: z.string(),
  walletAmount: z.number().int().positive(),
});

const TimelinePollPayoutSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('winner_takes_all'),
    amount: z.number().int().positive(),
    winnerOptionId: z.string(),
    recipientUserKey: z.string(),
    reportDayOffset: z.number().int(),
  }),
  z.object({
    mode: z.literal('proportional'),
    amount: z.number().int().positive(),
    shares: z.array(
      z.object({
        userKey: z.string(),
        percent: z.number().positive(),
      }),
    ),
    reportDayOffset: z.number().int(),
  }),
]);

const TimelinePollSchema = z.object({
  id: z.string(),
  authorKey: z.string(),
  dayOffset: z.number().int(),
  expiresDayOffset: z.number().int(),
  question: z.string(),
  description: z.string().optional(),
  options: z.array(TimelinePollOptionSchema).min(2),
  casts: z.array(TimelinePollCastSchema),
  payout: TimelinePollPayoutSchema,
});

const TimelinePostSchema = z.object({
  id: z.string(),
  authorKey: z.string(),
  dayOffset: z.number().int(),
  title: z.string(),
  content: z.string().optional(),
  contentFile: z.string().optional(),
  isPinned: z.boolean().optional(),
  linkedPollId: z.string().optional(),
});

const TimelineSchema = z.object({
  globalWalletCreditPerUser: z.number().int().nonnegative(),
  communityWalletTopUps: z.array(
    z.object({
      userKey: z.string(),
      amount: z.number().int().positive(),
      dayOffset: z.number().int(),
    }),
  ),
  polls: z.array(TimelinePollSchema),
  meritTransfers: z.array(
    z.object({
      senderKey: z.string(),
      receiverKey: z.string(),
      amount: z.number().int().positive(),
      comment: z.string(),
      dayOffset: z.number().int(),
    }),
  ),
  posts: z.array(TimelinePostSchema),
  postVotes: z.array(
    z.object({
      publicationId: z.string(),
      voterKey: z.string(),
      walletAmount: z.number().int().positive(),
      comment: z.string(),
    }),
  ),
  postComments: z.array(
    z.object({
      publicationId: z.string(),
      authorKey: z.string(),
      dayOffset: z.number().int(),
      content: z.string(),
    }),
  ),
  projectsCreatedDayOffset: z.object({
    horeca: z.number().int(),
    mentor: z.number().int(),
  }),
});

export const EntrepreneursDemoPackSchema = z.object({
  manifest: DemoManifestSchema,
  users: z.array(DemoUserSchema).length(10),
  community: DemoCommunitySchema,
  projects: z.array(DemoProjectSchema).length(2),
  timeline: TimelineSchema,
});

export type EntrepreneursDemoPack = z.infer<typeof EntrepreneursDemoPackSchema>;
export type EntrepreneursDemoUser = z.infer<typeof DemoUserSchema>;

/** Partial override JSON (media URLs, etc.) — no full-pack constraints. */
const EntrepreneursDemoPackOverrideSchema = z.object({
  manifest: DemoManifestSchema.partial().optional(),
  users: z
    .array(
      DemoUserSchema.partial().refine(
        (u) => Boolean(u.login || u.id),
        { message: 'Override user must include login or id' },
      ),
    )
    .optional(),
  community: DemoCommunitySchema.partial().optional(),
  projects: z
    .array(
      DemoProjectSchema.partial().refine((p) => Boolean(p.id), {
        message: 'Override project must include id',
      }),
    )
    .optional(),
  timeline: TimelineSchema.partial().optional(),
});

export type EntrepreneursDemoPackOverride = z.infer<
  typeof EntrepreneursDemoPackOverrideSchema
>;

function readJsonFile(dir: string, filename: string): unknown {
  const path = join(dir, filename);
  if (!existsSync(path)) {
    throw new Error(`Entrepreneurs demo pack file not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
}

function loadContentFile(dir: string, filename: string): string {
  const path = join(dir, 'content', filename);
  if (!existsSync(path)) {
    throw new Error(`Entrepreneurs demo content file not found: ${path}`);
  }
  return readFileSync(path, 'utf-8').trim();
}

/** Deep-merge pack override (typically media URLs) into bundled pack. */
function mergePackOverride(
  base: EntrepreneursDemoPack,
  override: EntrepreneursDemoPackOverride,
): EntrepreneursDemoPack {
  const merged = structuredClone(base) as EntrepreneursDemoPack;
  if (override.community) {
    merged.community = { ...merged.community, ...override.community };
    if (override.community.settings) {
      merged.community.settings = {
        ...merged.community.settings,
        ...override.community.settings,
      };
    }
    if (override.community.meritSettings) {
      merged.community.meritSettings = {
        ...merged.community.meritSettings,
        ...override.community.meritSettings,
      };
    }
  }
  if (override.users) {
    for (const ou of override.users) {
      const idx = merged.users.findIndex((u) => u.login === ou.login || u.id === ou.id);
      if (idx >= 0) {
        merged.users[idx] = { ...merged.users[idx], ...ou };
      }
    }
  }
  if (override.projects) {
    for (const op of override.projects) {
      const idx = merged.projects.findIndex((p) => p.id === op.id);
      if (idx >= 0) {
        merged.projects[idx] = { ...merged.projects[idx], ...op };
      }
    }
  }
  return merged;
}

export function loadEntrepreneursDemoPack(packOverrideJson?: string): EntrepreneursDemoPack {
  const dir = resolveEntrepreneursDemoPackDir();
  const raw = {
    manifest: readJsonFile(dir, 'manifest.json'),
    users: readJsonFile(dir, 'users.json'),
    community: readJsonFile(dir, 'community.json'),
    projects: readJsonFile(dir, 'projects.json'),
    timeline: readJsonFile(dir, 'timeline.json'),
  };
  const parsed = EntrepreneursDemoPackSchema.parse(raw);

  if (packOverrideJson?.trim()) {
    let overrideUnknown: unknown;
    try {
      overrideUnknown = JSON.parse(packOverrideJson) as unknown;
    } catch {
      throw new Error('packJson is not valid JSON');
    }
    const overridePartial = EntrepreneursDemoPackOverrideSchema.parse(overrideUnknown);
    return EntrepreneursDemoPackSchema.parse(mergePackOverride(parsed, overridePartial));
  }

  return parsed;
}

export function resolvePostContent(packDir: string, post: z.infer<typeof TimelinePostSchema>): string {
  if (post.contentFile) {
    return loadContentFile(packDir, post.contentFile);
  }
  return post.content ?? '';
}

export function validatePackBalances(pack: EntrepreneursDemoPack): void {
  const topUpTotal = pack.timeline.communityWalletTopUps.reduce((s, t) => s + t.amount, 0);
  const payoutTotal = pack.timeline.polls.reduce((s, p) => s + p.payout.amount, 0);
  if (topUpTotal < payoutTotal) {
    throw new Error(
      `Pack balance invalid: top-ups ${topUpTotal} < payouts ${payoutTotal}`,
    );
  }
  for (const poll of pack.timeline.polls) {
    if (poll.payout.mode === 'proportional') {
      const sum = poll.payout.shares.reduce((s, sh) => s + sh.percent, 0);
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error(`Poll ${poll.id} proportional shares must sum to 100, got ${sum}`);
      }
    }
  }
}

export function listDemoPersonasFromPack(pack: EntrepreneursDemoPack): Array<{
  authId: string;
  displayName: string;
  login: string;
  role: string;
}> {
  return pack.users.map((u) => ({
    authId: `demo_ent:${u.login}`,
    displayName: u.displayName,
    login: u.login,
    role: u.role,
  }));
}
