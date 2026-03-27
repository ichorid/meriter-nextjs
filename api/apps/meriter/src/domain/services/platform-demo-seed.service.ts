import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { mapDemoProjectValuesToDecree809 } from '../../seed-data/map-demo-project-values-to-decree809';
import { parseMeriterDemoProjectsTsv } from '../../seed-data/parse-meriter-demo-projects-tsv';
import { resolveMeriterDemoProjectsTsvPath } from '../../seed-data/resolve-seed-data-path';
import { GLOBAL_COMMUNITY_ID } from '../common/constants/global.constant';
import { PLATFORM_WIPE_SUPERADMIN } from '../common/constants/platform-bootstrap.constants';
import { CommunityService } from './community.service';
import { InvestmentService } from './investment.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PublicationService } from './publication.service';
import { UserService } from './user.service';
import { VoteService } from './vote.service';
import { WalletService } from './wallet.service';

const DEMO_SEED_VERSION = 6;

const DEFAULT_CURRENCY = {
  singular: 'merit',
  plural: 'merits',
  genitive: 'merits',
} as const;

/** Four superadmins (TSV authors). Dmitry exists after wipe — not in this list. */
const DEMO_EMAIL_USERS = [
  {
    authorKey: 'владислав',
    email: 'vldslvaia0@gmail.com',
    displayName: 'Владислав',
    firstName: 'Владислав',
    lastName: '-',
    bio: 'Публикации о корпоративных социальных проектах.',
  },
  {
    authorKey: 'руслан',
    email: 'rarusland@gmail.com',
    displayName: 'Руслан',
    firstName: 'Руслан',
    lastName: '-',
    bio: 'Публикации о корпоративных социальных проектах.',
  },
  {
    authorKey: 'ольга',
    email: 'cholgaa@rambler.ru',
    displayName: 'Ольга',
    firstName: 'Ольга',
    lastName: '-',
    bio: 'Публикации о корпоративных социальных проектах.',
  },
  {
    authorKey: 'софья',
    email: 'partner@merit.fund',
    displayName: 'Софья',
    firstName: 'Софья',
    lastName: '-',
    bio: 'Публикации о корпоративных социальных проектах.',
  },
] as const;

/** Final global-wallet targets (merits), distinct and ≥ 100. */
const TARGET_BALANCE_BY_EMAIL: Record<string, number> = {
  [PLATFORM_WIPE_SUPERADMIN.email]: 120,
  'vldslvaia0@gmail.com': 205,
  'rarusland@gmail.com': 340,
  'cholgaa@rambler.ru': 487,
  'partner@merit.fund': 650,
};

/** Row indices (0-based TSV rows) with investing + TTL — 10 posts. */
const INVESTING_ROW_INDICES = new Set([0, 4, 8, 12, 16, 20, 24, 28, 32, 36]);

const COMMENT_SNIPPETS = [
  'Сильный социальный акцент, поддерживаю.',
  'Важно для образования и людей рядом.',
  'Зрелая подача, видно системность.',
  'Интересный масштаб и измеримый эффект.',
  'Согласен с приоритетами проекта.',
  'Хорошая связка ценностей и практики.',
  'Это как раз про устойчивое развитие.',
  'Поддерживаю идею и прозрачность описания.',
  'Вижу пользу для сообщества.',
  'Актуально и по делу.',
  'Масштаб впечатляет, держу курс.',
  'Согласен: это усиливает доверие.',
  'Важный вклад в экологию и людей.',
  'Полезная инициатива для регионов.',
  'Сильный культурный и образовательный вектор.',
] as const;

function normalizeAuthorKey(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е')
    .toLowerCase();
}

function targetScoreForRow(sheetIndex: number, rowIndex: number): number {
  const x = sheetIndex * 7919 + rowIndex * 17 + 13;
  return 10 + (x % 991);
}

function splitIntoFiveParts(total: number): number[] {
  if (total < 5) {
    throw new Error(`splitIntoFiveParts: total ${total} < 5`);
  }
  const base = Math.floor(total / 5);
  const rem = total % 5;
  const out: number[] = [];
  for (let i = 0; i < 5; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

const SEED_SPREAD_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Spread posts across the past week ending near "now" (deterministic jitter, monotonic order). */
function seedPublicationCreatedAt(index: number, total: number): Date {
  const now = Date.now();
  if (total <= 1) {
    return new Date(now - SEED_SPREAD_WEEK_MS / 2);
  }
  const oldest = now - SEED_SPREAD_WEEK_MS;
  const frac = index / (total - 1);
  const linear = oldest + frac * SEED_SPREAD_WEEK_MS;
  const jitter =
    ((index * 7919 + total * 13) % 23) * 60 * 1000 - 11 * 60 * 1000;
  return new Date(linear + jitter);
}

@Injectable()
export class PlatformDemoSeedService {
  private readonly logger = new Logger(PlatformDemoSeedService.name);

  constructor(
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly walletService: WalletService,
    private readonly publicationService: PublicationService,
    private readonly voteService: VoteService,
    private readonly investmentService: InvestmentService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async seedDemoWorld(options: { force?: boolean } = {}): Promise<{
    usersCreated: number;
    marathonPosts: number;
    votesCreated: number;
    investmentPosts: number;
  }> {
    const existing = await this.platformSettingsService.getDemoSeedVersion();
    if (existing !== undefined && existing >= DEMO_SEED_VERSION && !options.force) {
      throw new BadRequestException(
        'Базовые данные уже загружены. Сначала выполните вайп платформы либо используйте force (не рекомендуется на проде).',
      );
    }

    const tsvPath = resolveMeriterDemoProjectsTsvPath();
    const raw = readFileSync(tsvPath, 'utf-8');
    const rows = parseMeriterDemoProjectsTsv(raw);
    if (rows.length !== 41) {
      throw new BadRequestException(
        `Ожидается 41 строка в TSV (лист «проекты»), получено ${rows.length}.`,
      );
    }

    await this.platformSettingsService.updateDecree809Enabled(true);
    await this.platformSettingsService.updateFutureVisionTags([]);

    const mdHub = await this.communityService.getCommunityByTypeTag('marathon-of-good');
    if (!mdHub?.id) {
      throw new BadRequestException('Не найден хаб «Биржа» (marathon-of-good).');
    }

    const dmitry = await this.userService.getUserByAuthId(
      'email',
      PLATFORM_WIPE_SUPERADMIN.email,
    );
    if (!dmitry?.id) {
      throw new BadRequestException(
        'Не найден суперадмин после вайпа (dmitrsosnin@gmail.com). Сначала выполните вайп.',
      );
    }

    const authorKeyToUserId = new Map<string, string>();
    let usersCreated = 0;
    for (const spec of DEMO_EMAIL_USERS) {
      const existed = await this.userService.getUserByAuthId('email', spec.email);
      const u = await this.userService.createOrUpdateUser({
        authProvider: 'email',
        authId: spec.email,
        username: spec.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
        firstName: spec.firstName,
        lastName: spec.lastName,
        displayName: spec.displayName,
        globalRole: 'superadmin',
      });
      authorKeyToUserId.set(spec.authorKey, u.id);
      if (!existed) {
        usersCreated += 1;
      }
      await this.userService.ensureUserInBaseCommunities(u.id);
      await this.userService.updateProfile(u.id, { bio: spec.bio });
    }

    authorKeyToUserId.set('дмитрий', dmitry.id);
    const dmitryId = dmitry.id;

    const voterIds: string[] = [
      authorKeyToUserId.get('владислав') ?? '',
      authorKeyToUserId.get('руслан') ?? '',
      authorKeyToUserId.get('ольга') ?? '',
      authorKeyToUserId.get('софья') ?? '',
      dmitryId,
    ].filter((id) => id.length > 0);

    if (voterIds.length !== 5) {
      throw new BadRequestException('Не удалось сопоставить пять пользователей для голосов.');
    }

    const SEED_CREDIT = 250_000;
    for (const uid of [...new Set([...voterIds, ...authorKeyToUserId.values()])]) {
      await this.walletService.addTransaction(
        uid,
        GLOBAL_COMMUNITY_ID,
        'credit',
        SEED_CREDIT,
        'personal',
        'demo_seed',
        uid,
        DEFAULT_CURRENCY,
        'Стартовый запас глобальных заслуг',
      );
    }

    const postCost = mdHub.settings?.postCost ?? 1;
    let votesCreated = 0;
    let investmentPosts = 0;

    const publicationIds: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = normalizeAuthorKey(row.author);
      const authorId = authorKeyToUserId.get(key);
      if (!authorId) {
        throw new BadRequestException(
          `Неизвестный автор «${row.author}» в строке ${row.sheetIndex}.`,
        );
      }

      const valueTags = mapDemoProjectValuesToDecree809(row.valuesRaw);
      const title = `«${row.company}»: ${row.title}`;
      let body = row.body;
      if (row.projectUrl) {
        body = `${body}\n\n${row.projectUrl}`;
      }
      const images = row.imageUrl ? [row.imageUrl] : [];

      const investing = INVESTING_ROW_INDICES.has(i);
      const pub = await this.publicationService.createPublication(authorId, {
        communityId: mdHub.id,
        content: body,
        type: 'text',
        title,
        postType: 'basic',
        images,
        valueTags,
        investingEnabled: investing,
        investorSharePercent: investing ? 30 : undefined,
        ...(investing ? { ttlDays: 30 as const } : {}),
      });
      const publicationId = pub.getId.getValue();
      publicationIds.push(publicationId);

      await this.publicationService.setPublicationTimestampsForSeed(
        publicationId,
        seedPublicationCreatedAt(i, rows.length),
      );

      if (postCost > 0) {
        await this.walletService.addTransaction(
          authorId,
          GLOBAL_COMMUNITY_ID,
          'debit',
          postCost,
          'personal',
          'publication_post_cost',
          publicationId,
          DEFAULT_CURRENCY,
          'Оплата публикации',
        );
      }

      if (investing) {
        investmentPosts += 1;
        const amounts = [28, 32, 40, 24];
        let ai = 0;
        for (const vid of voterIds) {
          if (vid === authorId) continue;
          const amt = amounts[ai % amounts.length] + (i % 7);
          ai += 1;
          await this.investmentService.processInvestment(publicationId, vid, amt);
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const key = normalizeAuthorKey(row.author);
      const authorId = authorKeyToUserId.get(key);
      if (!authorId) continue;

      const publicationId = publicationIds[i];
      const targetScore = targetScoreForRow(row.sheetIndex, i);
      const parts = splitIntoFiveParts(targetScore);

      for (let k = 0; k < 5; k++) {
        const voterId = voterIds[k];
        const w = parts[k] ?? 0;
        if (w <= 0) continue;
        const comment =
          COMMENT_SNIPPETS[(i * 5 + k) % COMMENT_SNIPPETS.length] ?? 'Поддерживаю.';
        await this.ensureWalletAndVote({
          voterId,
          publicationId,
          communityId: mdHub.id,
          walletAmount: w,
          comment,
        });
        votesCreated += 1;
      }

      const pubDoc = await this.publicationService.getPublicationDocument(publicationId);
      const score =
        (pubDoc?.metrics as { score?: number } | undefined)?.score ?? 0;
      const withdrawAmt = Math.min(40, Math.max(0, Math.floor(score * 0.12)));
      if (withdrawAmt > 0 && pubDoc) {
        await this.seedWithdrawPublication(publicationId, withdrawAmt, mdHub.id);
      }
    }

    const emails = [
      PLATFORM_WIPE_SUPERADMIN.email,
      ...DEMO_EMAIL_USERS.map((u) => u.email),
    ];
    for (const email of emails) {
      const target = TARGET_BALANCE_BY_EMAIL[email];
      if (target == null) continue;
      const u = await this.userService.getUserByAuthId('email', email);
      if (!u?.id) continue;
      await this.adjustGlobalBalanceTo(u.id, target);
    }

    await this.platformSettingsService.setDemoSeedVersion(DEMO_SEED_VERSION);

    this.logger.log(
      `Platform baseline seed v${DEMO_SEED_VERSION}: posts=${publicationIds.length}, votes=${votesCreated}, investPosts=${investmentPosts}`,
    );

    return {
      usersCreated,
      marathonPosts: publicationIds.length,
      votesCreated,
      investmentPosts,
    };
  }

  private async adjustGlobalBalanceTo(userId: string, target: number): Promise<void> {
    const w = await this.walletService.getWallet(userId, GLOBAL_COMMUNITY_ID);
    const cur = w ? w.getBalance() : 0;
    const delta = Math.round((target - cur) * 100) / 100;
    if (Math.abs(delta) < 0.01) return;
    if (delta > 0) {
      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        delta,
        'personal',
        'demo_seed_balance',
        userId,
        DEFAULT_CURRENCY,
        'Выравнивание баланса',
      );
    } else {
      await this.walletService.addTransaction(
        userId,
        GLOBAL_COMMUNITY_ID,
        'debit',
        -delta,
        'personal',
        'demo_seed_balance',
        userId,
        DEFAULT_CURRENCY,
        'Выравнивание баланса',
      );
    }
  }

  private async ensureWalletAndVote(params: {
    voterId: string;
    publicationId: string;
    communityId: string;
    walletAmount: number;
    comment: string;
  }): Promise<void> {
    const { voterId, publicationId, communityId, walletAmount, comment } = params;
    if (walletAmount <= 0) return;
    let w = await this.walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);
    let bal = w ? w.getBalance() : 0;
    if (bal < walletAmount) {
      await this.walletService.addTransaction(
        voterId,
        GLOBAL_COMMUNITY_ID,
        'credit',
        walletAmount - bal + 50_000,
        'personal',
        'demo_seed',
        voterId,
        DEFAULT_CURRENCY,
        'Пополнение для голоса',
      );
      w = await this.walletService.getWallet(voterId, GLOBAL_COMMUNITY_ID);
      bal = w ? w.getBalance() : 0;
    }
    if (bal < walletAmount) {
      throw new BadRequestException(
        'Недостаточно заслуг для голоса при заполнении базовых данных.',
      );
    }

    await this.voteService.createVote(
      voterId,
      'publication',
      publicationId,
      0,
      walletAmount,
      'up',
      comment,
      communityId,
    );
    await this.publicationService.voteOnPublication(
      publicationId,
      voterId,
      walletAmount,
      'up',
    );
    await this.walletService.addTransaction(
      voterId,
      GLOBAL_COMMUNITY_ID,
      'debit',
      walletAmount,
      'personal',
      'publication_vote',
      publicationId,
      DEFAULT_CURRENCY,
      'Голос за пост',
    );
  }

  private async seedWithdrawPublication(
    publicationId: string,
    amount: number,
    mdCommunityId: string,
  ): Promise<void> {
    const pub = await this.publicationService.getPublication(publicationId);
    if (!pub) return;
    const score = pub.getMetrics.score;
    if (amount > score || amount <= 0) return;

    const pubDoc = await this.publicationService.getPublicationDocument(publicationId);
    const community = await this.communityService.getCommunity(mdCommunityId);
    if (!community) return;

    const beneficiaryId = pub.getEffectiveBeneficiary().getValue();
    const currency = community.settings?.currencyNames ?? DEFAULT_CURRENCY;

    let authorCredit = amount;
    if (pubDoc?.investments?.length && pubDoc.investorSharePercent != null) {
      const dist = await this.investmentService.distributeOnWithdrawal(
        publicationId,
        amount,
      );
      authorCredit = dist.authorAmount;
    }

    await this.walletService.addTransaction(
      beneficiaryId,
      GLOBAL_COMMUNITY_ID,
      'credit',
      authorCredit,
      'personal',
      'publication_withdrawal',
      publicationId,
      currency,
      'Вывод с поста',
    );
    await this.publicationService.reduceScore(publicationId, amount);
  }
}
