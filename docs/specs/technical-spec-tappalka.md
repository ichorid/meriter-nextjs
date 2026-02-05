# Technical Spec: Tappalka

> Техническая спецификация для реализации механики Tappalka.
> Используй этот документ как reference при работе в Cursor.

---

## 1. Изменения в модели Community

### 1.1 Новый интерфейс TappalkaSettings

Добавить в `api/apps/meriter/src/communities/community.schema.ts`:

```typescript
export interface CommunityTappalkaSettings {
  /** Whether tappalka is enabled for this community */
  enabled: boolean;
  
  /** Category IDs to include in tappalka. Empty array = all categories */
  categories: string[];
  
  /** Merits awarded to winning post (emission). Default: 1 */
  winReward: number;
  
  /** Merits awarded to user for completing comparisons. Default: 1 */
  userReward: number;
  
  /** Number of comparisons required to earn userReward. Default: 10 */
  comparisonsRequired: number;
  
  /** Cost per post show (deducted from both posts). Default: 0.1 */
  showCost: number;
  
  /** Minimum post rating to participate. Default: 1 */
  minRating: number;
  
  /** Custom onboarding text. If empty, use default */
  onboardingText?: string;
}
```

### 1.2 Mongoose Schema для TappalkaSettings

Добавить в Community schema (по аналогии с meritSettings):

```typescript
@Prop({
  type: {
    enabled: { type: Boolean, default: false },
    categories: { type: [String], default: [] },
    winReward: { type: Number, default: 1 },
    userReward: { type: Number, default: 1 },
    comparisonsRequired: { type: Number, default: 10 },
    showCost: { type: Number, default: 0.1 },
    minRating: { type: Number, default: 1 },
    onboardingText: { type: String },
  },
  default: {
    enabled: false,
    categories: [],
    winReward: 1,
    userReward: 1,
    comparisonsRequired: 10,
    showCost: 0.1,
    minRating: 1,
  },
})
tappalkaSettings?: CommunityTappalkaSettings;
```

---

## 2. Zod-схемы (shared-types)

Добавить в `libs/shared-types/src/schemas.ts` или создать `libs/shared-types/src/tappalka.ts`:

```typescript
import { z } from 'zod';

// ============================================
// TAPPALKA SETTINGS
// ============================================

export const TappalkaSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  winReward: z.number().positive().default(1),
  userReward: z.number().positive().default(1),
  comparisonsRequired: z.number().int().positive().default(10),
  showCost: z.number().nonnegative().default(0.1),
  minRating: z.number().nonnegative().default(1),
  onboardingText: z.string().optional(),
});

export type TappalkaSettings = z.infer<typeof TappalkaSettingsSchema>;

// ============================================
// TAPPALKA API SCHEMAS
// ============================================

/** Post data for tappalka display */
export const TappalkaPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
  authorName: z.string(),
  authorAvatarUrl: z.string().optional(),
  rating: z.number(),
  categoryId: z.string().optional(),
});

export type TappalkaPost = z.infer<typeof TappalkaPostSchema>;

/** Pair of posts for comparison */
export const TappalkaPairSchema = z.object({
  postA: TappalkaPostSchema,
  postB: TappalkaPostSchema,
  /** Unique identifier for this comparison session */
  sessionId: z.string(),
});

export type TappalkaPair = z.infer<typeof TappalkaPairSchema>;

/** User's tappalka progress in a community */
export const TappalkaProgressSchema = z.object({
  /** Current comparisons count (resets after reaching comparisonsRequired) */
  currentComparisons: z.number().int().nonnegative(),
  /** Comparisons needed for reward (from community settings) */
  comparisonsRequired: z.number().int().positive(),
  /** User's current merit balance (global) */
  meritBalance: z.number(),
  /** Whether user has seen onboarding for this community */
  onboardingSeen: z.boolean(),
  /** Onboarding text from community settings */
  onboardingText: z.string().optional(),
});

export type TappalkaProgress = z.infer<typeof TappalkaProgressSchema>;

/** Result of submitting a choice */
export const TappalkaChoiceResultSchema = z.object({
  success: z.boolean(),
  /** New comparison count after this choice */
  newComparisonCount: z.number().int(),
  /** Merits earned by user (if completed comparisonsRequired) */
  userMeritsEarned: z.number().optional(),
  /** Whether this choice completed a reward cycle */
  rewardEarned: z.boolean(),
  /** Next pair (for seamless UX) */
  nextPair: TappalkaPairSchema.optional(),
  /** Message if no more posts available */
  noMorePosts: z.boolean().optional(),
});

export type TappalkaChoiceResult = z.infer<typeof TappalkaChoiceResultSchema>;

// ============================================
// TAPPALKA API INPUT SCHEMAS
// ============================================

export const GetTappalkaPairInputSchema = z.object({
  communityId: z.string(),
});

export const SubmitTappalkaChoiceInputSchema = z.object({
  communityId: z.string(),
  sessionId: z.string(),
  winnerPostId: z.string(),
  loserPostId: z.string(),
});

export const GetTappalkaProgressInputSchema = z.object({
  communityId: z.string(),
});

export const MarkTappalkaOnboardingSeenInputSchema = z.object({
  communityId: z.string(),
});

// ============================================
// TAPPALKA SETTINGS UPDATE SCHEMA
// ============================================

export const UpdateTappalkaSettingsInputSchema = z.object({
  communityId: z.string(),
  settings: TappalkaSettingsSchema.partial(),
});
```

---

## 3. API Контракты (tRPC Router)

### 3.1 Router Structure

Создать `api/apps/meriter/src/trpc/routers/tappalka.router.ts`:

```typescript
import { router, protectedProcedure } from '../trpc';
import {
  GetTappalkaPairInputSchema,
  SubmitTappalkaChoiceInputSchema,
  GetTappalkaProgressInputSchema,
  MarkTappalkaOnboardingSeenInputSchema,
  TappalkaPairSchema,
  TappalkaProgressSchema,
  TappalkaChoiceResultSchema,
} from '@meriter/shared-types';

export const tappalkaRouter = router({
  /**
   * Get a pair of posts for comparison
   * 
   * Business rules:
   * - Exclude user's own posts
   * - Only posts with rating >= minRating
   * - Only posts from allowed categories (if specified)
   * - Only posts that can pay showCost
   * - Random selection
   */
  getPair: protectedProcedure
    .input(GetTappalkaPairInputSchema)
    .output(TappalkaPairSchema.nullable())
    .query(async ({ ctx, input }) => {
      // TODO: Implement via TappalkaService
    }),

  /**
   * Submit user's choice
   * 
   * Business rules:
   * - Validate sessionId matches current pair
   * - Deduct showCost from both posts
   * - Award winReward to winner (emission)
   * - Increment user's comparison count
   * - If count >= comparisonsRequired: award userReward, reset count
   * - Return next pair for seamless UX
   */
  submitChoice: protectedProcedure
    .input(SubmitTappalkaChoiceInputSchema)
    .output(TappalkaChoiceResultSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement via TappalkaService
    }),

  /**
   * Get user's progress in tappalka for a community
   */
  getProgress: protectedProcedure
    .input(GetTappalkaProgressInputSchema)
    .output(TappalkaProgressSchema)
    .query(async ({ ctx, input }) => {
      // TODO: Implement via TappalkaService
    }),

  /**
   * Mark onboarding as seen for a community
   */
  markOnboardingSeen: protectedProcedure
    .input(MarkTappalkaOnboardingSeenInputSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement via TappalkaService
    }),
});
```

### 3.2 Добавить в главный router

В `api/apps/meriter/src/trpc/routers/index.ts`:

```typescript
import { tappalkaRouter } from './tappalka.router';

export const appRouter = router({
  // ... existing routers
  tappalka: tappalkaRouter,
});
```

---

## 4. TappalkaService

Создать `api/apps/meriter/src/services/tappalka.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';

@Injectable()
export class TappalkaService {
  constructor(
    @InjectModel('Post') private postModel: Model<Post>,
    @InjectModel('Community') private communityModel: Model<Community>,
    @InjectModel('User') private userModel: Model<User>,
    private meritService: MeritService,
  ) {}

  /**
   * Get eligible posts for tappalka
   */
  async getEligiblePosts(
    communityId: string,
    excludeUserId: string,
  ): Promise<Post[]> {
    const community = await this.communityModel.findById(communityId);
    if (!community?.tappalkaSettings?.enabled) {
      return [];
    }

    const { categories, minRating, showCost } = community.tappalkaSettings;

    const query: any = {
      communityId,
      authorId: { $ne: excludeUserId },
      status: 'active', // not closed
      rating: { $gte: minRating },
      // Post must be able to pay showCost (from rating or author wallet)
      $or: [
        { rating: { $gte: showCost } },
        // TODO: check author wallet balance
      ],
    };

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      query.categoryId = { $in: categories };
    }

    return this.postModel.find(query).exec();
  }

  /**
   * Select random pair from eligible posts
   */
  async getPair(
    communityId: string,
    userId: string,
  ): Promise<TappalkaPair | null> {
    const posts = await this.getEligiblePosts(communityId, userId);
    
    if (posts.length < 2) {
      return null;
    }

    // Random selection of 2 different posts
    const shuffled = posts.sort(() => Math.random() - 0.5);
    const [postA, postB] = shuffled.slice(0, 2);

    return {
      postA: this.mapPostToTappalkaPost(postA),
      postB: this.mapPostToTappalkaPost(postB),
      sessionId: randomUUID(),
    };
  }

  /**
   * Process user's choice
   */
  async submitChoice(
    communityId: string,
    userId: string,
    sessionId: string,
    winnerPostId: string,
    loserPostId: string,
  ): Promise<TappalkaChoiceResult> {
    const community = await this.communityModel.findById(communityId);
    if (!community?.tappalkaSettings?.enabled) {
      throw new Error('Tappalka is not enabled for this community');
    }

    const { showCost, winReward, userReward, comparisonsRequired } = 
      community.tappalkaSettings;

    // 1. Validate posts still exist and are eligible
    const [winner, loser] = await Promise.all([
      this.postModel.findById(winnerPostId),
      this.postModel.findById(loserPostId),
    ]);

    if (!winner || !loser) {
      throw new Error('Posts no longer available');
    }

    // 2. Deduct showCost from both posts
    await this.deductShowCost(winner, showCost);
    await this.deductShowCost(loser, showCost);

    // 3. Award winReward to winner (EMISSION, not transfer)
    await this.meritService.emitMerits(winnerPostId, winReward, 'tappalka_win');

    // 4. Update user's comparison count
    const { newCount, rewardEarned } = await this.updateUserProgress(
      userId,
      communityId,
      comparisonsRequired,
      userReward,
    );

    // 5. Get next pair for seamless UX
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
   * Get user's tappalka progress
   */
  async getProgress(
    communityId: string,
    userId: string,
  ): Promise<TappalkaProgress> {
    // TODO: Implement - fetch from user's tappalka progress collection
  }

  /**
   * Mark onboarding as seen
   */
  async markOnboardingSeen(
    communityId: string,
    userId: string,
  ): Promise<void> {
    // TODO: Implement - update user's tappalka progress
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapPostToTappalkaPost(post: Post): TappalkaPost {
    return {
      id: post._id.toString(),
      title: post.title,
      description: post.description,
      imageUrl: post.images?.[0]?.url,
      authorName: post.author?.name ?? 'Unknown',
      authorAvatarUrl: post.author?.avatarUrl,
      rating: post.rating,
      categoryId: post.categoryId,
    };
  }

  private async deductShowCost(post: Post, cost: number): Promise<void> {
    // Try to deduct from post rating first
    if (post.rating >= cost) {
      await this.postModel.updateOne(
        { _id: post._id },
        { $inc: { rating: -cost } },
      );
    } else {
      // Deduct from author's wallet
      await this.meritService.deductFromWallet(
        post.authorId,
        cost,
        'tappalka_show_cost',
      );
    }
  }

  private async updateUserProgress(
    userId: string,
    communityId: string,
    comparisonsRequired: number,
    userReward: number,
  ): Promise<{ newCount: number; rewardEarned: boolean }> {
    // TODO: Implement progress tracking
    // 1. Increment comparison count
    // 2. If count >= comparisonsRequired:
    //    - Award userReward to user's wallet (EMISSION)
    //    - Reset count to 0
    //    - Return rewardEarned: true
    // 3. Return current count and rewardEarned: false
    
    return { newCount: 0, rewardEarned: false };
  }
}
```

---

## 5. User Tappalka Progress Model

Нужна модель для хранения прогресса пользователя. Два варианта:

### Вариант A: Отдельная коллекция (рекомендуется)

Создать `api/apps/meriter/src/tappalka/tappalka-progress.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TappalkaProgress extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Community', required: true })
  communityId!: Types.ObjectId;

  @Prop({ type: Number, default: 0 })
  comparisonCount!: number;

  @Prop({ type: Boolean, default: false })
  onboardingSeen!: boolean;

  @Prop({ type: Number, default: 0 })
  totalComparisons!: number;

  @Prop({ type: Number, default: 0 })
  totalRewardsEarned!: number;
}

export const TappalkaProgressSchema = SchemaFactory.createForClass(TappalkaProgress);

// Compound index for fast lookups
TappalkaProgressSchema.index({ userId: 1, communityId: 1 }, { unique: true });
```

### Вариант B: Поле в User модели

Если хотите хранить в User:

```typescript
@Prop({
  type: Map,
  of: {
    comparisonCount: Number,
    onboardingSeen: Boolean,
    totalComparisons: Number,
    totalRewardsEarned: Number,
  },
  default: {},
})
tappalkaProgress?: Map<string, UserTappalkaProgress>;
```

**Рекомендация:** Вариант A (отдельная коллекция) — лучше масштабируется и проще запрашивать.

---

## 6. Frontend Components

### 6.1 Структура файлов

```
web/src/features/tappalka/
├── components/
│   ├── TappalkaScreen.tsx        # Основной контейнер
│   ├── TappalkaHeader.tsx        # Прогресс, баланс, назад
│   ├── TappalkaPostCard.tsx      # Карточка поста
│   ├── TappalkaMeritIcon.tsx     # Draggable иконка
│   ├── TappalkaOnboarding.tsx    # Bottom sheet
│   └── TappalkaEmptyState.tsx    # Нет постов
├── hooks/
│   ├── useTappalkaPair.ts
│   ├── useTappalkaChoice.ts
│   ├── useTappalkaProgress.ts
│   └── useTappalkaOnboarding.ts
├── types.ts                       # Re-export from shared-types
└── index.ts                       # Public exports
```

### 6.2 Component Props

```typescript
// TappalkaScreen.tsx
interface TappalkaScreenProps {
  communityId: string;
  onClose: () => void;
}

// TappalkaHeader.tsx
interface TappalkaHeaderProps {
  currentComparisons: number;
  comparisonsRequired: number;
  meritBalance: number;
  onBack: () => void;
}

// TappalkaPostCard.tsx
interface TappalkaPostCardProps {
  post: TappalkaPost;
  isSelected: boolean;
  isDropTarget: boolean;
  onDrop: () => void;
}

// TappalkaMeritIcon.tsx
interface TappalkaMeritIconProps {
  onDragStart: () => void;
  onDragEnd: () => void;
}

// TappalkaOnboarding.tsx
interface TappalkaOnboardingProps {
  text: string;
  onDismiss: () => void;
}
```

### 6.3 Hooks Implementation

```typescript
// useTappalkaPair.ts
export function useTappalkaPair(communityId: string) {
  return trpc.tappalka.getPair.useQuery(
    { communityId },
    { 
      enabled: !!communityId,
      staleTime: 0, // Always fresh
    }
  );
}

// useTappalkaChoice.ts
export function useTappalkaChoice() {
  const utils = trpc.useUtils();
  
  return trpc.tappalka.submitChoice.useMutation({
    onSuccess: (data) => {
      // Invalidate progress to update UI
      utils.tappalka.getProgress.invalidate();
      
      // If nextPair is included, we can use it directly
      // instead of refetching
    },
  });
}

// useTappalkaProgress.ts
export function useTappalkaProgress(communityId: string) {
  return trpc.tappalka.getProgress.useQuery(
    { communityId },
    { enabled: !!communityId }
  );
}
```

---

## 7. Настройки в админке сообщества

### 7.1 Компонент TappalkaSettingsForm

```typescript
// web/src/features/community-settings/components/TappalkaSettingsForm.tsx

interface TappalkaSettingsFormProps {
  communityId: string;
  currentSettings: TappalkaSettings;
  categories: Category[]; // Для мультиселекта категорий
  onSave: (settings: Partial<TappalkaSettings>) => void;
}

// Поля формы:
// - enabled: Switch
// - categories: MultiSelect (из списка категорий сообщества)
// - winReward: NumberInput (min: 0.1)
// - userReward: NumberInput (min: 0.1)
// - comparisonsRequired: NumberInput (min: 1, integer)
// - showCost: NumberInput (min: 0)
// - minRating: NumberInput (min: 0)
// - onboardingText: Textarea
```

---

## 8. Checklist реализации

### Backend
- [ ] Добавить `CommunityTappalkaSettings` интерфейс
- [ ] Добавить `tappalkaSettings` в Community schema
- [ ] Создать Zod-схемы в shared-types
- [ ] Создать `TappalkaProgress` модель
- [ ] Создать `TappalkaService`
- [ ] Создать `tappalka.router.ts`
- [ ] Добавить router в главный appRouter
- [ ] Написать unit tests для TappalkaService

### Frontend
- [ ] Создать структуру `features/tappalka/`
- [ ] Реализовать хуки
- [ ] Реализовать TappalkaScreen
- [ ] Реализовать drag-and-drop
- [ ] Реализовать онбординг
- [ ] Добавить TappalkaSettingsForm в админку
- [ ] Добавить точку входа (кнопка в сообществе)

### Integration
- [ ] E2E тест полного flow
- [ ] Проверить edge cases (нет постов, сеть, закрытие)
