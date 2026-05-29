import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Community } from '../models/community/community.schema';
import type { CommunityTappalkaSettings } from '../models/community/community.schema';
import type { PublicationSnapshot } from '../../common/interfaces/publication-document.interface';
import { MeritService } from './merit.service';
import { MeritResolverService } from './merit-resolver.service';
import { WalletService } from './wallet.service';
import { NotificationService } from './notification.service';
import { CommunityWalletService } from './community-wallet.service';
import type {
  TappalkaPair,
  TappalkaPost,
  TappalkaProgress,
  TappalkaChoiceResult,
} from '@meriter/shared-types/tappalka';
import {
  stripHtmlToPlainText,
  truncatePlainText,
} from '../../common/helpers/html-plain-text';
import {
  TAPPALKA_PERSISTENCE_PORT,
  type TappalkaPersistencePort,
  type TappalkaSessionRecord,
} from '../ports/tappalka.persistence.port';
import {
  COMMUNITY_PERSISTENCE_PORT,
  type CommunityPersistencePort,
  type CommunitySnapshot,
} from '../ports/community.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';

function asCommunity(snapshot: CommunitySnapshot): Community {
  return snapshot as unknown as Community;
}

/**
 * TappalkaService
 *
 * Service for managing tappalka (post comparison) mechanic.
 * Handles:
 * - Selecting eligible posts for comparison
 * - Generating pairs of posts
 * - Processing user choices
 * - Managing user progress and rewards
 */
@Injectable()
export class TappalkaService {
  private readonly logger = new Logger(TappalkaService.name);

  /** One-time comparison token lifetime (server-enforced). */
  private static readonly SESSION_TTL_MS = 10 * 60 * 1000;

  constructor(
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
    @Inject(COMMUNITY_PERSISTENCE_PORT)
    private readonly communityPersistence: CommunityPersistencePort,
    @Inject(TAPPALKA_PERSISTENCE_PORT)
    private readonly tappalkaPersistence: TappalkaPersistencePort,
    private meritService: MeritService,
    private meritResolverService: MeritResolverService,
    private walletService: WalletService,
    private communityWalletService: CommunityWalletService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get eligible posts for tappalka
   * 
   * Business rules:
   * - Exclude user's own posts
   * - Only posts with rating >= minRating
   * - Only posts from allowed categories (if specified)
   * - Only posts that can pay showCost (checked via rating >= showCost)
   * - Post must be active (not closed/deleted)
   */
  async getEligiblePosts(
    communityId: string,
    excludeUserId: string,
  ): Promise<PublicationSnapshot[]> {
    const community = await this.communityPersistence.findById(communityId);

    if (!community) {
      this.logger.warn(`Community not found: ${communityId}`);
      return [];
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(asCommunity(community));

    if (!tappalkaSettings.enabled) {
      this.logger.debug(`Tappalka is not enabled for community: ${communityId}`);
      return [];
    }

    const { categories, minRating, showCost } = tappalkaSettings;

    // Build query: post must be able to pay showCost from pool and/or rating (C-5: rating only down to stopLoss)
    // Spendable = pool + max(0, score - stopLoss). Post eligible if spendable >= showCost (and minRating when using rating).
    const minScore = Math.max(minRating, showCost);
    const query: any = {
      communityId,
      authorId: { $ne: excludeUserId }, // Exclude user's own posts
      deleted: { $ne: true }, // Not deleted
      deletedAt: null,
      // D-1: Exclude closed posts from tappalka (missing status = legacy active)
      status: { $ne: 'closed' },
      $or: [
        { investmentPool: { $gte: showCost } },
        { 'metrics.score': { $gte: minScore } },
        {
          $and: [
            {
              $expr: {
                $gte: [
                  {
                    $add: [
                      { $ifNull: ['$investmentPool', 0] },
                      {
                        $max: [
                          0,
                          {
                            $subtract: [
                              { $ifNull: ['$metrics.score', 0] },
                              { $ifNull: ['$stopLoss', 0] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  showCost,
                ],
              },
            },
            {
              $or: [
                { investmentPool: { $gte: showCost } },
                { 'metrics.score': { $gte: minRating } },
              ],
            },
          ],
        },
      ],
    };

    // Filter by value rubricator tags and/or legacy publication category IDs
    if (categories && categories.length > 0) {
      query.$and = [
        {
          $or: [
            { valueTags: { $in: categories } },
            { categories: { $in: categories } },
          ],
        },
      ];
    }

    const posts = await this.publicationPersistence.findByQuery({ query });

    this.logger.debug(
      `Found ${posts.length} eligible posts for tappalka in community ${communityId}`,
    );

    return posts;
  }

  /**
   * Get effective tappalka settings (with defaults)
   * Similar to getEffectiveMeritSettings and getEffectiveVotingSettings
   */
  private getEffectiveTappalkaSettings(
    community: Community,
  ): CommunityTappalkaSettings {
    // Default settings from schema
    const defaults: CommunityTappalkaSettings = {
      enabled: false,
      categories: [],
      winReward: 1,
      userReward: 1,
      comparisonsRequired: 10,
      showCost: 0.1,
      minRating: 1,
    };

    if (!community.tappalkaSettings) {
      return defaults;
    }

    return {
      ...defaults,
      ...community.tappalkaSettings,
      categories: community.tappalkaSettings.categories ?? defaults.categories,
    };
  }

  /**
   * Select random pair from eligible posts
   * 
   * Returns a pair of posts for comparison, or null if not enough posts available.
   */
  async getPair(
    communityId: string,
    userId: string,
  ): Promise<TappalkaPair | null> {
    // Get eligible posts
    const posts = await this.getEligiblePosts(communityId, userId);

    if (posts.length < 2) {
      this.logger.debug(
        `Not enough eligible posts for tappalka: ${posts.length} (need at least 2)`,
      );
      return null;
    }

    // Random selection of 2 different posts
    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    const [postA, postB] = shuffled.slice(0, 2);

    // Map posts to TappalkaPost format
    const tappalkaPostA = await this.mapPostToTappalkaPost(postA);
    const tappalkaPostB = await this.mapPostToTappalkaPost(postB);

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TappalkaService.SESSION_TTL_MS);

    await this.tappalkaPersistence.createSession({
      id: sessionId,
      userId,
      communityId,
      postAId: String(postA.id),
      postBId: String(postB.id),
      status: 'pending',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    this.logger.debug(
      `Generated tappalka pair: sessionId=${sessionId}, postA=${postA.id}, postB=${postB.id}`,
    );

    return {
      postA: tappalkaPostA,
      postB: tappalkaPostB,
      sessionId,
    };
  }

  private assertChoiceMatchesSession(
    session: Pick<TappalkaSessionRecord, 'postAId' | 'postBId'>,
    winnerPostId: string,
    loserPostId: string,
  ): void {
    const allowed = new Set([session.postAId, session.postBId]);
    if (
      !allowed.has(winnerPostId) ||
      !allowed.has(loserPostId) ||
      winnerPostId === loserPostId
    ) {
      throw new Error('Choice does not match comparison pair');
    }
  }

  private async claimComparisonSession(
    sessionId: string,
    userId: string,
  ): Promise<TappalkaSessionRecord | null> {
    const now = new Date();
    return this.tappalkaPersistence.claimPendingSession(sessionId, userId, now);
  }

  private async finalizeComparisonSession(
    sessionId: string,
    result: TappalkaChoiceResult,
  ): Promise<void> {
    const now = new Date();
    await this.tappalkaPersistence.consumeSession(
      sessionId,
      result,
      now,
      now,
    );
  }

  private async getReplayedChoiceResult(
    sessionId: string,
    userId: string,
  ): Promise<TappalkaChoiceResult | null> {
    const session = await this.tappalkaPersistence.findConsumedSession(
      sessionId,
      userId,
    );
    if (!session?.storedResult) {
      return null;
    }
    return session.storedResult as TappalkaChoiceResult;
  }

  private static readonly TAPPALKA_SUMMARY_MAX_CHARS = 500;

  /**
   * Plain text for mining cards: project/community fields when linked, else publication description.
   */
  private async buildSummaryPlainText(post: PublicationSnapshot): Promise<string> {
    let raw = '';

    if (post.sourceEntityType === 'project' && post.sourceEntityId) {
      const proj = await this.communityPersistence.findById(post.sourceEntityId);
      if (proj?.isProject) {
        const parts = [proj.description, proj.futureVisionText].filter(
          (p): p is string => typeof p === 'string' && p.trim().length > 0,
        );
        raw = parts.join('\n\n');
      }
    } else if (post.sourceEntityType === 'community' && post.sourceEntityId) {
      const comm = await this.communityPersistence.findById(post.sourceEntityId);
      if (comm) {
        const parts = [comm.description, comm.futureVisionText].filter(
          (p): p is string => typeof p === 'string' && p.trim().length > 0,
        );
        raw = parts.join('\n\n');
      }
    }

    if (!raw) {
      const fromDescription = stripHtmlToPlainText(String(post.description || ''));
      const fromContent = stripHtmlToPlainText(String(post.content || ''));
      raw = fromDescription || fromContent;
    }

    return truncatePlainText(raw, TappalkaService.TAPPALKA_SUMMARY_MAX_CHARS);
  }

  /**
   * Map PublicationDocument to TappalkaPost
   */
  private async mapPostToTappalkaPost(
    post: PublicationSnapshot,
  ): Promise<TappalkaPost> {
    const summaryPlainText = await this.buildSummaryPlainText(post);

    // Get first image if available - ensure it's a string or undefined
    let imageUrl: string | undefined = undefined;
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      imageUrl = String(post.images[0]);
    } else if (post.imageUrl) {
      imageUrl = String(post.imageUrl);
    }

    // Get first category if available - ensure it's a string or undefined
    let categoryId: string | undefined = undefined;
    if (post.categories && Array.isArray(post.categories) && post.categories.length > 0) {
      categoryId = String(post.categories[0]);
    }

    // Ensure all types match schema
    return {
      id: String(post.id), // Ensure it's a string (not ObjectId)
      title: String(post.title || ''),
      description: String(post.description || ''),
      imageUrl, // string | undefined
      summaryPlainText,
      categoryId, // string | undefined
    };
  }

  /**
   * Process user's choice
   * 
   * Business rules:
   * - Validate sessionId matches current pair (sessionId validation can be added later if needed)
   * - Deduct showCost from both posts (from rating, if not enough - from author wallet)
   * - Award winReward to winner (emission to post rating)
   * - Increment user's comparison count
   * - If count >= comparisonsRequired: award userReward, reset count
   * - Return next pair for seamless UX
   */
  async submitChoice(
    communityId: string,
    userId: string,
    sessionId: string,
    winnerPostId: string,
    loserPostId: string,
  ): Promise<TappalkaChoiceResult> {
    const replayed = await this.getReplayedChoiceResult(sessionId, userId);
    if (replayed) {
      return replayed;
    }

    const claimed = await this.claimComparisonSession(sessionId, userId);
    if (!claimed) {
      const replayedAfterRace = await this.getReplayedChoiceResult(sessionId, userId);
      if (replayedAfterRace) {
        return replayedAfterRace;
      }
      throw new Error('Invalid or expired comparison session');
    }

    if (claimed.communityId !== communityId) {
      throw new Error('Invalid comparison session');
    }

    this.assertChoiceMatchesSession(claimed, winnerPostId, loserPostId);

    try {
      return await this.executeSubmitChoice(
        communityId,
        userId,
        sessionId,
        winnerPostId,
        loserPostId,
      );
    } catch (error) {
      await this.releaseProcessingSession(sessionId);
      throw error;
    }
  }

  private async releaseProcessingSession(sessionId: string): Promise<void> {
    await this.tappalkaPersistence.releaseProcessingSession(
      sessionId,
      new Date(),
    );
  }

  private async executeSubmitChoice(
    communityId: string,
    userId: string,
    sessionId: string,
    winnerPostId: string,
    loserPostId: string,
  ): Promise<TappalkaChoiceResult> {
    // Get community and tappalka settings
    const community = await this.communityPersistence.findById(communityId);

    if (!community) {
      throw new Error(`Community not found: ${communityId}`);
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(asCommunity(community));

    if (!tappalkaSettings.enabled) {
      throw new Error('Mining is not enabled for this community');
    }

    const { showCost, winReward, userReward, comparisonsRequired } =
      tappalkaSettings;

    // Validate posts still exist and are eligible
    const [winner, loser] = await Promise.all([
      this.publicationPersistence.findById(winnerPostId),
      this.publicationPersistence.findById(loserPostId),
    ]);

    if (!winner || !loser) {
      throw new Error('Posts no longer available');
    }

    // Check posts are not deleted
    if (winner.deleted || loser.deleted) {
      throw new Error('Posts are deleted');
    }

    // Check posts are in the same community
    if (winner.communityId !== communityId || loser.communityId !== communityId) {
      throw new Error('Posts are not in the same community');
    }

    // 1. Deduct showCost from both posts
    await this.deductShowCost(winner, showCost);
    await this.deductShowCost(loser, showCost);

    // 2. Award winReward to winner (EMISSION, not transfer - add to rating). D-8: track lastEarnedAt.
    const now = new Date();
    await this.publicationPersistence.patchById(winnerPostId, {
      inc: { 'metrics.score': winReward, lifetimeCredits: winReward },
      set: { lastEarnedAt: now },
    });

    this.logger.debug(
      `Awarded ${winReward} merits to winner post ${winnerPostId}`,
    );

    // 3. Update user's comparison count
    const { newCount, rewardEarned } = await this.updateUserProgress(
      userId,
      communityId,
      comparisonsRequired,
      userReward,
      asCommunity(community),
    );

    // 4. Get next pair for seamless UX
    const nextPair = await this.getPair(communityId, userId);

    // Build result object ensuring all types match schema
    // Ensure newCount is an integer (required by schema: z.number().int())
    const newComparisonCount = Math.floor(Number(newCount));
    
    // Build result with required fields
    const result: TappalkaChoiceResult = {
      success: true,
      newComparisonCount,
      rewardEarned: Boolean(rewardEarned),
    };

    // Include optional fields only if they have meaningful values
    if (rewardEarned && userReward > 0) {
      result.userMeritsEarned = Number(userReward);
    }

    if (nextPair !== null) {
      result.nextPair = nextPair;
    } else {
      // If no next pair, indicate that there are no more posts
      result.noMorePosts = true;
    }

    await this.finalizeComparisonSession(sessionId, result);

    return result;
  }

  /**
   * Deduct showCost from post.
   * C-5: Priority per business-investing.mdc — investmentPool → rating (down to stopLoss) → author.wallet (unless noAuthorWalletSpend).
   */
  private async deductShowCost(
    post: PublicationSnapshot,
    cost: number,
  ): Promise<void> {
    const currentPool = post.investmentPool ?? 0;
    const currentRating = post.metrics?.score || 0;
    const stopLoss = post.stopLoss ?? 0;
    const noAuthorWalletSpend = post.noAuthorWalletSpend ?? false;

    let remainingCost = cost;

    // 1. Try investment pool first (atomic: conditional update to prevent negative)
    if (remainingCost > 0 && currentPool > 0) {
      const fromPool = Math.min(currentPool, remainingCost);
      const result = await this.publicationPersistence.findAndPatchOne(
        { id: post.id, investmentPool: { $gte: fromPool } },
        { inc: { investmentPool: -fromPool } },
      );
      if (result) {
        remainingCost -= fromPool;
        this.logger.debug(
          `Deducted ${fromPool} from post ${post.id} investment pool`,
        );
      } else {
        const fresh = await this.publicationPersistence.findById(post.id);
        const actualPool = fresh?.investmentPool ?? 0;
        const actualDeduct = Math.min(actualPool, remainingCost);
        if (actualDeduct > 0) {
          const retryResult = await this.publicationPersistence.findAndPatchOne(
            { id: post.id, investmentPool: { $gte: actualDeduct } },
            { inc: { investmentPool: -actualDeduct } },
          );
          if (retryResult) {
            remainingCost -= actualDeduct;
            this.logger.debug(
              `Deducted ${actualDeduct} from post ${post.id} investment pool (retry)`,
            );
          }
        }
      }
      // C-10: Notify author when pool is depleted (shows now from rating/wallet)
      if (remainingCost > 0) {
        try {
          await this.notificationService.createNotification({
            userId: post.authorId,
            type: 'investment_pool_depleted',
            source: 'system',
            metadata: { postId: post.id, communityId: post.communityId, variant: 'pool_depleted' },
            title: 'Investment pool depleted',
            message: 'Investment pool depleted. Shows now deducted from post rating.',
          });
        } catch (err) {
          this.logger.warn(`Failed to create investment_pool_depleted notification: ${err}`);
        }
      }
      if (remainingCost <= 0) return;
    }

    // 2. Try rating (do not reduce below stopLoss)
    const availableFromRating = Math.max(0, currentRating - stopLoss);
    if (availableFromRating > 0 && remainingCost > 0) {
      const fromRating = Math.min(remainingCost, availableFromRating);
      await this.publicationPersistence.patchById(post.id, {
        inc: { 'metrics.score': -fromRating },
      });
      remainingCost -= fromRating;
      this.logger.debug(
        `Deducted ${fromRating} from post ${post.id} rating (stopLoss=${stopLoss})`,
      );
      if (remainingCost <= 0) return;
    }

    // 3. If post has sourceEntityId (Birzha project/community source), try CommunityWallet before author wallet
    const sourceEntityId = post.sourceEntityId as string | undefined;
    if (remainingCost > 0 && sourceEntityId) {
      try {
        await this.communityWalletService.deductBalance(
          sourceEntityId,
          remainingCost,
          'tappalka_show_cost',
        );
        remainingCost = 0;
        this.logger.debug(
          `Deducted show cost from project CommunityWallet for post ${post.id}`,
        );
        return;
      } catch {
        // Insufficient balance → post exits tappalka (do not use author wallet)
        try {
          await this.notificationService.createNotification({
            userId: post.authorId,
            type: 'investment_pool_depleted',
            source: 'system',
            metadata: { postId: post.id, communityId: post.communityId },
            title: 'Post exited tappalka',
            message: 'Post exited tappalka — no funds available for shows.',
          });
        } catch (err) {
          this.logger.warn(`Failed to create post-exited-tappalka notification: ${err}`);
        }
        this.logger.debug(
          `Post ${post.id} exited tappalka (CommunityWallet insufficient, remainingCost=${remainingCost})`,
        );
        return;
      }
    }

    // 4. Remaining cost: author wallet or post exits tappalka
    // C-10: Notify author when post exits tappalka (noAuthorWalletSpend, no funds)
    if (noAuthorWalletSpend) {
      try {
        await this.notificationService.createNotification({
          userId: post.authorId,
          type: 'investment_pool_depleted',
          source: 'system',
          metadata: { postId: post.id, communityId: post.communityId, variant: 'exited_tappalka' },
          title: 'Post exited tappalka',
          message: 'Post exited tappalka — no funds available for shows.',
        });
      } catch (err) {
        this.logger.warn(`Failed to create post-exited-tappalka notification: ${err}`);
      }
      this.logger.debug(
        `Post ${post.id} exited tappalka (noAuthorWalletSpend, remainingCost=${remainingCost})`,
      );
      return;
    }

    const communityDoc = await this.communityPersistence.findById(post.communityId);

    if (!communityDoc) {
      throw new Error(`Community not found: ${post.communityId}`);
    }

    const community = asCommunity(communityDoc);
    const currency = community.settings.currencyNames;

    const walletCommunityId = this.meritResolverService.getWalletCommunityId(
      community,
      'tappalka_reward',
    );

    if (remainingCost > 0) {
      await this.walletService.addTransaction(
        post.authorId,
        walletCommunityId,
        'debit',
        remainingCost,
        'personal',
        'tappalka_show_cost',
        post.id,
        currency,
        `Tappalka show cost for post ${post.id}`,
      );
      this.logger.debug(
        `Deducted ${remainingCost} from author wallet for post ${post.id}`,
      );
    }
  }

  /**
   * Update user's tappalka progress
   * Returns new count and whether reward was earned
   */
  private async updateUserProgress(
    userId: string,
    communityId: string,
    comparisonsRequired: number,
    userReward: number,
    community: Community,
  ): Promise<{ newCount: number; rewardEarned: boolean }> {
    // Get or create progress record
    let progress = await this.tappalkaPersistence.findProgress(userId, communityId);

    if (!progress) {
      // Create new progress record
      progress = await this.tappalkaPersistence.createProgress({
        id: randomUUID(),
        userId,
        communityId,
        comparisonCount: 1,
        onboardingSeen: false,
        totalComparisons: 1,
        totalRewardsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Increment comparison count
      const currentCount = progress.comparisonCount || 0;
      const newCount = currentCount + 1;
      const rewardEarned = newCount >= comparisonsRequired;

      // Update progress
      if (rewardEarned) {
        // Reset count to 0 and increment totalRewardsEarned
        await this.tappalkaPersistence.updateProgress(userId, communityId, {
          set: {
            comparisonCount: 0,
            totalRewardsEarned: (progress.totalRewardsEarned || 0) + 1,
            updatedAt: new Date(),
          },
          inc: {
            totalComparisons: 1,
          },
        });

        // Award userReward to user's wallet
        const currency = community.settings.currencyNames;
        const targetCommunityId = this.meritResolverService.getWalletCommunityId(
          community,
          'tappalka_reward',
        );
        await this.walletService.addTransaction(
          userId,
          targetCommunityId,
          'credit',
          userReward,
          'personal',
          'tappalka_reward',
          communityId,
          currency,
          `Tappalka reward for ${comparisonsRequired} comparisons`,
        );

        this.logger.debug(
          `Awarded ${userReward} merits to user ${userId} for completing ${comparisonsRequired} comparisons`,
        );
      } else {
        // Just increment count
        await this.tappalkaPersistence.updateProgress(userId, communityId, {
          inc: {
            comparisonCount: 1,
            totalComparisons: 1,
          },
          set: {
            updatedAt: new Date(),
          },
        });
      }

      return {
        newCount: Math.floor(rewardEarned ? 0 : newCount),
        rewardEarned: Boolean(rewardEarned),
      };
    }

    // New progress created - check if first comparison already reached required
    const rewardEarned = 1 >= comparisonsRequired;
    if (rewardEarned) {
      // Award reward and reset count
      await this.tappalkaPersistence.updateProgress(userId, communityId, {
        set: {
          comparisonCount: 0,
          totalRewardsEarned: 1,
          updatedAt: new Date(),
        },
      });

      const currency = community.settings.currencyNames;
      const targetCommunityId = this.meritResolverService.getWalletCommunityId(
        community,
        'tappalka_reward',
      );
      await this.walletService.addTransaction(
        userId,
        targetCommunityId,
        'credit',
        userReward,
        'personal',
        'tappalka_reward',
        communityId,
        currency,
        `Tappalka reward for ${comparisonsRequired} comparisons`,
      );
    }

    return {
      newCount: rewardEarned ? 0 : 1,
      rewardEarned,
    };
  }

  /**
   * Get user's tappalka progress in a community
   * 
   * Returns progress data including:
   * - Current comparison count
   * - Comparisons required for reward
   * - User's merit balance (from wallet in this community)
   * - Onboarding status
   * - Onboarding text from community settings
   */
  async getProgress(
    communityId: string,
    userId: string,
  ): Promise<TappalkaProgress> {
    // Get community and tappalka settings
    const community = await this.communityPersistence.findById(communityId);

    if (!community) {
      throw new Error(`Community not found: ${communityId}`);
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(asCommunity(community));

    // Get or create progress record
    let progress = await this.tappalkaPersistence.findProgress(userId, communityId);

    if (!progress) {
      // Create new progress record with defaults
      progress = await this.tappalkaPersistence.createProgress({
        id: randomUUID(),
        userId,
        communityId,
        comparisonCount: 0,
        onboardingSeen: false,
        totalComparisons: 0,
        totalRewardsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Get user's wallet balance (global for priority communities)
    const walletCommunityId = this.meritResolverService.getWalletCommunityId(
      asCommunity(community),
      'tappalka_reward',
    );
    const wallet = await this.walletService.getWallet(userId, walletCommunityId);
    const meritBalance = wallet?.getBalance() ?? 0;

    const progressSafe = progress!;
    return {
      currentComparisons: progressSafe.comparisonCount || 0,
      comparisonsRequired: tappalkaSettings.comparisonsRequired,
      meritBalance,
      onboardingSeen: progressSafe.onboardingSeen || false,
      onboardingText: tappalkaSettings.onboardingText,
    };
  }

  /**
   * Mark onboarding as seen for a community
   */
  async markOnboardingSeen(
    communityId: string,
    userId: string,
  ): Promise<void> {
    // Get or create progress record
    const progress = await this.tappalkaPersistence.findProgress(userId, communityId);

    if (!progress) {
      // Create new progress record with onboardingSeen = true
      await this.tappalkaPersistence.createProgress({
        id: randomUUID(),
        userId,
        communityId,
        comparisonCount: 0,
        onboardingSeen: true,
        totalComparisons: 0,
        totalRewardsEarned: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Update existing progress record
      await this.tappalkaPersistence.updateProgress(userId, communityId, {
        set: {
          onboardingSeen: true,
          updatedAt: new Date(),
        },
      });
    }

    this.logger.debug(
      `Marked onboarding as seen for user ${userId} in community ${communityId}`,
    );
  }
}

