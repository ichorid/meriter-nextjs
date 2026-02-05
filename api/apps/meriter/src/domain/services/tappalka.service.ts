import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import {
  PublicationSchemaClass,
  PublicationDocument,
} from '../models/publication/publication.schema';
import {
  CommunitySchemaClass,
  CommunityDocument,
  type Community,
  type CommunityTappalkaSettings,
} from '../models/community/community.schema';
import {
  TappalkaProgressSchemaClass,
  TappalkaProgressDocument,
} from '../models/tappalka/tappalka-progress.schema';
import { MeritService } from './merit.service';
import { WalletService } from './wallet.service';
import { UserService } from './user.service';
import type {
  TappalkaPair,
  TappalkaPost,
  TappalkaProgress,
  TappalkaChoiceResult,
} from '@meriter/shared-types';

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

  constructor(
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
    @InjectModel(CommunitySchemaClass.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(TappalkaProgressSchemaClass.name)
    private tappalkaProgressModel: Model<TappalkaProgressDocument>,
    private meritService: MeritService,
    private walletService: WalletService,
    private userService: UserService,
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
  ): Promise<PublicationDocument[]> {
    // Get community and check tappalka settings
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean()
      .exec();

    if (!community) {
      this.logger.warn(`Community not found: ${communityId}`);
      return [];
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(
      community as unknown as Community,
    );

    if (!tappalkaSettings.enabled) {
      this.logger.debug(`Tappalka is not enabled for community: ${communityId}`);
      return [];
    }

    const { categories, minRating, showCost } = tappalkaSettings;

    // Build query
    const query: any = {
      communityId,
      authorId: { $ne: excludeUserId }, // Exclude user's own posts
      deleted: { $ne: true }, // Not deleted
      deletedAt: null, // Not deleted (double check)
      'metrics.score': { $gte: Math.max(minRating, showCost) }, // Rating >= minRating and can pay showCost
    };

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      query.categories = { $in: categories };
    }

    // Execute query
    const posts = await this.publicationModel.find(query).lean().exec();

    this.logger.debug(
      `Found ${posts.length} eligible posts for tappalka in community ${communityId}`,
    );

    return posts as PublicationDocument[];
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

    // Generate session ID
    const sessionId = randomUUID();

    this.logger.debug(
      `Generated tappalka pair: sessionId=${sessionId}, postA=${postA.id}, postB=${postB.id}`,
    );

    return {
      postA: tappalkaPostA,
      postB: tappalkaPostB,
      sessionId,
    };
  }

  /**
   * Map PublicationDocument to TappalkaPost
   */
  private async mapPostToTappalkaPost(
    post: PublicationDocument,
  ): Promise<TappalkaPost> {
    // Get author information
    const author = await this.userService.getUserById(post.authorId);
    const authorName = author?.displayName || post.authorDisplay || 'Unknown';
    const authorAvatarUrl = author?.avatarUrl;

    // Get first image if available
    const imageUrl =
      post.images && post.images.length > 0
        ? post.images[0]
        : post.imageUrl;

    // Get first category if available
    const categoryId =
      post.categories && post.categories.length > 0
        ? post.categories[0]
        : undefined;

    return {
      id: post.id,
      title: post.title || '',
      description: post.description || '',
      imageUrl,
      authorName,
      authorAvatarUrl,
      rating: post.metrics?.score || 0,
      categoryId,
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
    // Get community and tappalka settings
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean()
      .exec();

    if (!community) {
      throw new Error(`Community not found: ${communityId}`);
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(
      community as unknown as Community,
    );

    if (!tappalkaSettings.enabled) {
      throw new Error('Tappalka is not enabled for this community');
    }

    const { showCost, winReward, userReward, comparisonsRequired } =
      tappalkaSettings;

    // Validate posts still exist and are eligible
    const [winner, loser] = await Promise.all([
      this.publicationModel.findOne({ id: winnerPostId }).lean().exec(),
      this.publicationModel.findOne({ id: loserPostId }).lean().exec(),
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
    await this.deductShowCost(winner as PublicationDocument, showCost);
    await this.deductShowCost(loser as PublicationDocument, showCost);

    // 2. Award winReward to winner (EMISSION, not transfer - add to rating)
    await this.publicationModel.updateOne(
      { id: winnerPostId },
      { $inc: { 'metrics.score': winReward } },
    );

    this.logger.debug(
      `Awarded ${winReward} merits to winner post ${winnerPostId}`,
    );

    // 3. Update user's comparison count
    const { newCount, rewardEarned } = await this.updateUserProgress(
      userId,
      communityId,
      comparisonsRequired,
      userReward,
      community as unknown as Community,
    );

    // 4. Get next pair for seamless UX
    const nextPair = await this.getPair(communityId, userId);

    return {
      success: true,
      newComparisonCount: newCount,
      userMeritsEarned: rewardEarned ? userReward : undefined,
      rewardEarned,
      nextPair: nextPair ?? undefined,
      noMorePosts: !nextPair,
    };
  }

  /**
   * Deduct showCost from post
   * First tries to deduct from post rating, if not enough - deducts from author wallet
   */
  private async deductShowCost(
    post: PublicationDocument,
    cost: number,
  ): Promise<void> {
    const currentRating = post.metrics?.score || 0;

    if (currentRating >= cost) {
      // Deduct from post rating
      await this.publicationModel.updateOne(
        { id: post.id },
        { $inc: { 'metrics.score': -cost } },
      );
      this.logger.debug(
        `Deducted ${cost} from post ${post.id} rating (new rating: ${currentRating - cost})`,
      );
    } else {
      // Deduct from author's wallet
      const community = await this.communityModel
        .findOne({ id: post.communityId })
        .lean()
        .exec();

      if (!community) {
        throw new Error(`Community not found: ${post.communityId}`);
      }

      const currency = (community as unknown as Community).settings
        .currencyNames;

      // Deduct remaining amount from wallet
      const remainingCost = cost - currentRating;

      // First, reduce rating to 0 if it was positive
      if (currentRating > 0) {
        await this.publicationModel.updateOne(
          { id: post.id },
          { $set: { 'metrics.score': 0 } },
        );
      }

      // Then deduct from wallet
      await this.walletService.addTransaction(
        post.authorId,
        post.communityId,
        'debit',
        remainingCost,
        'personal',
        'tappalka_show_cost',
        post.id,
        currency,
        `Tappalka show cost for post ${post.id}`,
      );

      this.logger.debug(
        `Deducted ${currentRating} from post ${post.id} rating and ${remainingCost} from author wallet`,
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
    let progress = await this.tappalkaProgressModel
      .findOne({ userId, communityId })
      .lean()
      .exec();

    if (!progress) {
      // Create new progress record
      const newProgress = await this.tappalkaProgressModel.create({
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
      progress = newProgress.toObject();
    } else {
      // Increment comparison count
      const currentCount = progress.comparisonCount || 0;
      const newCount = currentCount + 1;
      const rewardEarned = newCount >= comparisonsRequired;

      // Update progress
      if (rewardEarned) {
        // Reset count to 0 and increment totalRewardsEarned
        await this.tappalkaProgressModel.updateOne(
          { userId, communityId },
          {
            $set: {
              comparisonCount: 0,
              totalRewardsEarned: (progress.totalRewardsEarned || 0) + 1,
              updatedAt: new Date(),
            },
            $inc: {
              totalComparisons: 1,
            },
          },
        );

        // Award userReward to user's wallet
        const currency = community.settings.currencyNames;
        await this.walletService.addTransaction(
          userId,
          communityId,
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
        await this.tappalkaProgressModel.updateOne(
          { userId, communityId },
          {
            $inc: {
              comparisonCount: 1,
              totalComparisons: 1,
            },
            $set: {
              updatedAt: new Date(),
            },
          },
        );
      }

      return {
        newCount: rewardEarned ? 0 : newCount,
        rewardEarned,
      };
    }

    // New progress created - check if first comparison already reached required
    const rewardEarned = 1 >= comparisonsRequired;
    if (rewardEarned) {
      // Award reward and reset count
      await this.tappalkaProgressModel.updateOne(
        { userId, communityId },
        {
          $set: {
            comparisonCount: 0,
            totalRewardsEarned: 1,
            updatedAt: new Date(),
          },
        },
      );

      const currency = community.settings.currencyNames;
      await this.walletService.addTransaction(
        userId,
        communityId,
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
    const community = await this.communityModel
      .findOne({ id: communityId })
      .lean()
      .exec();

    if (!community) {
      throw new Error(`Community not found: ${communityId}`);
    }

    const tappalkaSettings = this.getEffectiveTappalkaSettings(
      community as unknown as Community,
    );

    // Get or create progress record
    let progress = await this.tappalkaProgressModel
      .findOne({ userId, communityId })
      .lean()
      .exec();

    if (!progress) {
      // Create new progress record with defaults
      const newProgress = await this.tappalkaProgressModel.create({
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
      progress = newProgress.toObject();
    }

    // Get user's wallet balance in this community
    const wallet = await this.walletService.getWallet(userId, communityId);
    const meritBalance = wallet?.balance || 0;

    return {
      currentComparisons: progress.comparisonCount || 0,
      comparisonsRequired: tappalkaSettings.comparisonsRequired,
      meritBalance,
      onboardingSeen: progress.onboardingSeen || false,
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
    const progress = await this.tappalkaProgressModel
      .findOne({ userId, communityId })
      .lean()
      .exec();

    if (!progress) {
      // Create new progress record with onboardingSeen = true
      await this.tappalkaProgressModel.create({
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
      await this.tappalkaProgressModel.updateOne(
        { userId, communityId },
        {
          $set: {
            onboardingSeen: true,
            updatedAt: new Date(),
          },
        },
      );
    }

    this.logger.debug(
      `Marked onboarding as seen for user ${userId} in community ${communityId}`,
    );
  }
}

