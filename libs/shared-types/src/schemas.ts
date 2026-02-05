import { z } from "zod";
import {
  TimestampsSchema,
  IdentifiableSchema,
  VotableMetricsSchema,
  PolymorphicReferenceSchema,
  CurrencySchema,
} from "./base-schemas";
import {
  IMPACT_AREAS,
  BENEFICIARIES,
  METHODS,
  STAGES,
  HELP_NEEDED,
} from "./taxonomy";
import { TappalkaSettingsSchema } from "./tappalka";

// Metrics schemas extending base VotableMetricsSchema
export const PublicationMetricsSchema = VotableMetricsSchema.extend({
  commentCount: z.number().int().min(0),
});

export const CommentMetricsSchema = VotableMetricsSchema.extend({
  replyCount: z.number().int().min(0),
});

export const PollMetricsSchema = z.object({
  totalCasts: z.number().int().min(0),
  casterCount: z.number().int().min(0),
  totalAmount: z.number().int().min(0),
});

// User profile and community settings
export const UserLocationSchema = z.object({
  region: z.string().min(1),
  city: z.string().min(1),
});

export const UserContactsSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  messenger: z.string().optional().or(z.literal("")),
});

export const UserProfileSchema = z.object({
  bio: z.string().max(1000).optional(), // "О себе", до 1000 символов
  location: UserLocationSchema.optional(), // Регион и населенный пункт из OSM API
  website: z.string().url().optional().or(z.literal("")),
  isVerified: z.boolean().default(false),
  about: z.string().max(1000).optional(), // "О себе", до 1000 символов
  contacts: UserContactsSchema.optional(), // Публикуются только для superadmin и lead
  educationalInstitution: z.string().max(200).optional(), // Educational institution (required for Member and Representative)
});

// Profile fields that can be updated
const ProfileFieldsSchema = z.object({
  bio: z.string().max(1000).optional().nullable(),
  location: UserLocationSchema.optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  about: z.string().max(1000).optional().nullable(),
  contacts: UserContactsSchema.optional().nullable(),
  educationalInstitution: z.string().max(200).optional().nullable(),
});

export const UpdateUserProfileSchema = z.object({
  // Top-level user fields
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  // Profile fields can be sent at top level (for backwards compatibility)
  bio: z.string().max(1000).optional().nullable(),
  location: UserLocationSchema.optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal("")),
  about: z.string().max(1000).optional().nullable(),
  contacts: UserContactsSchema.optional().nullable(),
  educationalInstitution: z.string().max(200).optional().nullable(),
  // Or nested in profile object (frontend sends this way)
  profile: ProfileFieldsSchema.optional(),
});

export const CommunitySettingsSchema = z.object({
  iconUrl: z.string().url().optional(),
  currencyNames: CurrencySchema,
  dailyEmission: z.number().int().min(0).default(10),
  language: z.enum(["en", "ru"]).default("en"),
  postCost: z.number().int().min(0).default(1), // Cost in wallet merits to create a post (0 = free)
  pollCost: z.number().int().min(0).default(1), // Cost in wallet merits to create a poll (0 = free)
  forwardCost: z.number().int().min(0).default(1), // Cost in wallet merits to forward a post (0 = free)
  editWindowMinutes: z.number().int().min(0).default(30), // Number of minutes after creation that participants can edit publications (0 = no time limit)
  allowEditByOthers: z.boolean().default(false), // Allow participants to edit publications created by others in the same community
  canPayPostFromQuota: z.boolean().default(false), // Whether posts can be paid from quota instead of wallet only
  allowWithdraw: z.boolean().default(true), // Whether users can withdraw merits from their own posts
  forwardRule: z.enum(["standard", "project"]).default("standard"), // Forward rule: 'standard' = forward without votes, keep original; 'project' = forward with votes, delete original
});

export const CommunityMeritConversionSchema = z.object({
  targetCommunityId: z.string(),
  ratio: z.number(),
});

export const CommunityMeritSettingsSchema = z.object({
  dailyQuota: z.number().int().min(0).optional(),
  quotaRecipients: z.array(z.enum(["superadmin", "lead", "participant"])).optional(),
  canEarn: z.boolean().optional(),
  canSpend: z.boolean().optional(),
  startingMerits: z.number().int().min(0).optional(),
  quotaEnabled: z.boolean().optional(),
});

export const CommunityVotingSettingsSchema = z.object({
  spendsMerits: z.boolean().optional(),
  awardsMerits: z.boolean().optional(),
  meritConversion: CommunityMeritConversionSchema.optional(),
  votingRestriction: z.preprocess(
    (val) => {
      // Normalize votingRestriction: handle array case (legacy data) and ensure it's a string
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        // If it's an array, take the first valid value
        const first = val[0];
        return (first === 'any' || first === 'not-same-team') ? first : 'any';
      }
      // If it's already a string, return as is
      if (typeof val === 'string' && (val === 'any' || val === 'not-same-team')) {
        return val;
      }
      // Invalid value, default to 'any'
      return 'any';
    },
    z.enum(["any", "not-same-team"]).optional()
  ),
  currencySource: z.enum(["quota-and-wallet", "quota-only", "wallet-only"]).optional(),
  // Note: 'not-own' removed - self-voting now uses currency constraint (wallet-only)
  // Note: 'not-same-group' renamed to 'not-same-team' for clarity
});

// Permission rule schema - granular role -> action -> allow/deny rules
export const PermissionRuleConditionsSchema = z.object({
  requiresTeamMembership: z.boolean().optional(),
  onlyTeamLead: z.boolean().optional(),
  canVoteForOwnPosts: z.boolean().optional(),
  participantsCannotVoteForLead: z.boolean().optional(),
  canEditWithVotes: z.boolean().optional(),
  canEditWithComments: z.boolean().optional(),
  canEditAfterMinutes: z.number().int().min(0).optional(),
  canDeleteWithVotes: z.boolean().optional(),
  canDeleteWithComments: z.boolean().optional(),
  teamOnly: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const PermissionRuleSchema = z.object({
  role: z.enum(["superadmin", "lead", "participant"]),
  action: z.string(), // ActionType enum value
  allowed: z.boolean(),
  conditions: PermissionRuleConditionsSchema.optional(),
});

export const PollOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(200),
  votes: z.number().int().min(0),
  amount: z.number().int().min(0),
  casterCount: z.number().int().min(0),
});

// UserCommunityRole schema
export const UserCommunityRoleSchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  userId: z.string(),
  communityId: z.string(),
  role: z.enum(["lead", "participant"]), // В БД 'lead', в переводах 'representative'
});

// Invite schema
export const InviteSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  code: z.string().min(1),
  type: z.enum(["superadmin-to-lead", "lead-to-participant"]), // В переводах "superadmin-to-representative" и "representative-to-participant"
  createdBy: z.string(),
  targetUserId: z.string().optional(), // ID конкретного пользователя, для которого создан инвайт (опционально, если указан targetUserName)
  targetUserName: z.string().optional(), // Имя нового пользователя (опционально, если указан targetUserId)
  usedBy: z.string().optional(), // Должен совпадать с targetUserId
  usedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isUsed: z.boolean().default(false), // Инвайты одноразовые
  communityId: z.string(),
});

// Main entity schemas
// WebAuthn Authenticator Schema
export const AuthenticatorSchema = z.object({
  credentialID: z.string(),
  credentialPublicKey: z.string(),
  counter: z.number(),
  credentialDeviceType: z.string(),
  credentialBackedUp: z.boolean(),
  transports: z.array(z.string()).optional(),
  deviceName: z.string().optional(), // For UI management / multi-device support
});

export const UserSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  authProvider: z.string(),
  authId: z.string(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  globalRole: z.enum(["superadmin"]).optional(), // Глобальная роль (только для суперадминов)
  profile: UserProfileSchema.default({ isVerified: false }),
  meritStats: z.record(z.string(), z.number().int().min(0)).optional(), // Статистика меритов по коммьюнити (только для lead)
  teamId: z.string().optional(), // ID команды, к которой принадлежит пользователь
  communityTags: z.array(z.string()).default([]),
  communityMemberships: z.array(z.string()).default([]),
  authenticators: z.array(AuthenticatorSchema).default([]), // Available passkeys
});

export const CommunitySchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  name: z.string().min(1),
  description: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  // IDs of administrators (internal User IDs) - УСТАРЕВШЕЕ, использовать UserCommunityRole
  adminIds: z.array(z.string()).default([]),
  members: z.array(z.string()).default([]), // УСТАРЕВШЕЕ, использовать UserCommunityRole
  // НОВОЕ: Метка типа (опциональная, только для удобства)
  typeTag: z
    .enum([
      "future-vision",
      "marathon-of-good",
      "support",
      "team-projects",
      "team",
      "political",
      "housing",
      "volunteer",
      "corporate",
      "custom",
    ])
    .optional(),
  // НОВОЕ: Связанные валюты (настраивается)
  linkedCurrencies: z.array(z.string()).optional(),
  // Granular permission rules - replaces postingRules, votingRules, visibilityRules, meritRules
  permissionRules: z.array(PermissionRuleSchema).optional(),
  settings: CommunitySettingsSchema,
  hashtags: z.array(z.string()).default([]),
  hashtagDescriptions: z.record(z.string(), z.string()).optional().default({}),
  isActive: z.boolean().default(true),
  isPriority: z.boolean().optional().default(false), // Приоритетные сообщества отображаются первыми
  isAdmin: z.boolean().optional(), // Computed field - is current user an admin?
  needsSetup: z.boolean().optional(), // Computed field - does community need setup?
});

export const PublicationSchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  communityId: z.string(),
  authorId: z.string(),
  beneficiaryId: z.string().optional(),
  // НОВОЕ: Тип поста (базовый, опрос, проект)
  postType: z.enum(["basic", "poll", "project"]).optional().default("basic"),
  // НОВОЕ: Метка проекта (для "Марафон добра")
  isProject: z.boolean().optional().default(false),
  // НОВОЕ: Заголовок (обязательное поле для всех постов)
  title: z.string().min(1).max(500).optional(),
  // НОВОЕ: Описание (обязательное поле)
  description: z.string().min(1).max(5000).optional(),
  content: z.string().min(1).max(10000),
  type: z.enum(["text", "image", "video"]), // Медиа-тип (остается для обратной совместимости)
  hashtags: z.array(z.string()).default([]),
  metrics: PublicationMetricsSchema,
  images: z.array(z.string().url()).optional(), // Array of images for gallery
  videoUrl: z.string().url().optional(),
  // НОВОЕ: Автор поста (отображаемое имя, может отличаться от authorId)
  authorDisplay: z.string().optional(),
  // Taxonomy fields for project categorization
  impactArea: z.enum([...IMPACT_AREAS] as [string, ...string[]]).optional(),
  beneficiaries: z.array(z.enum([...BENEFICIARIES] as [string, ...string[]])).max(2).default([]),
  methods: z.array(z.enum([...METHODS] as [string, ...string[]])).max(3).default([]),
  stage: z.enum([...STAGES] as [string, ...string[]]).optional(),
  helpNeeded: z.array(z.enum([...HELP_NEEDED] as [string, ...string[]])).max(3).default([]),
  // Forward fields
  forwardStatus: z.enum(["pending", "forwarded"]).nullable().optional(),
  forwardTargetCommunityId: z.string().optional(),
  forwardProposedBy: z.string().optional(),
  forwardProposedAt: z.date().optional(),
  deleted: z.boolean().optional().default(false),
  deletedAt: z.date().optional(),
  // Edit history
  editHistory: z.array(z.object({
    editedBy: z.string(),
    editedAt: z.date(),
  })).optional().default([]),
});

export const CommentAuthorMetaSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  username: z.string().optional(),
  photoUrl: z.string().url().optional(),
});

export const ResourcePermissionsSchema = z.object({
  canVote: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canComment: z.boolean(),
  voteDisabledReason: z.string().optional(),
  editDisabledReason: z.string().optional(),
  deleteDisabledReason: z.string().optional(),
});

export const CommentSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  targetType: z.enum(["publication", "comment"]),
  targetId: z.string(),
  authorId: z.string(),
  content: z.string().max(5000),
  metrics: CommentMetricsSchema,
  parentCommentId: z.string().optional(),
  meta: z
    .object({
      author: CommentAuthorMetaSchema,
    })
    .optional(),
  permissions: ResourcePermissionsSchema.optional(),
});

export const VoteSchema = PolymorphicReferenceSchema.extend({
  id: z.string(),
  userId: z.string(),
  amountQuota: z.number().int().min(0).default(0),
  amountWallet: z.number().int().min(0).default(0),
  direction: z.enum(["up", "down"]), // Explicit vote direction: upvote or downvote
  communityId: z.string(),
  comment: z.string().max(5000), // Required comment text attached to vote
  createdAt: z.string().datetime(),
  updatedAt: z.string().optional(), // Optional for votes
}).refine((data) => data.amountQuota > 0 || data.amountWallet > 0, {
  message:
    "At least one of amountQuota or amountWallet must be greater than zero",
});

export const PollSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  communityId: z.string(),
  authorId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z.array(PollOptionSchema).min(2),
  expiresAt: z.string().datetime(),
  isActive: z.boolean().default(true),
  metrics: PollMetricsSchema,
  permissions: ResourcePermissionsSchema.optional(),
});

export const PollCastSchema = IdentifiableSchema.merge(TimestampsSchema)
  .extend({
    pollId: z.string(),
    optionId: z.string(), // Changed from optionIndex to optionId
    userId: z.string(),
    amountQuota: z.number().int().min(0).default(0),
    amountWallet: z.number().int().min(0).default(0),
    communityId: z.string(), // Added for consistency
  })
  .refine((data) => data.amountQuota > 0 || data.amountWallet > 0, {
    message:
      "At least one of amountQuota or amountWallet must be greater than zero",
  });

export const WalletSchema = IdentifiableSchema.merge(TimestampsSchema).extend({
  userId: z.string(),
  communityId: z.string(),
  balance: z.number().int().min(0),
  currency: CurrencySchema,
  lastUpdated: z.string().datetime(),
});

// Transaction schema - ADDED (was missing)
export const TransactionSchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  walletId: z.string(),
  type: z.enum(["vote", "comment", "poll_cast", "withdrawal", "deposit"]),
  amount: z.number().int(),
  description: z.string().optional(), // Made optional to match current usage
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
});

// DTO schemas for API requests
export const CreatePublicationDtoSchema = z.object({
  communityId: z.string(),
  postType: z.enum(["basic", "poll", "project"]).optional().default("basic"),
  isProject: z.boolean().optional().default(false),
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  content: z.string().min(1).max(10000),
  type: z.enum(["text", "image", "video"]),
  beneficiaryId: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(), // Array of category IDs
  images: z.array(z.string().url()).optional(), // Array of image URLs for multi-image support
  videoUrl: z.string().url().optional(),
  authorDisplay: z.string().optional(),
  // Taxonomy fields
  impactArea: z.enum([...IMPACT_AREAS] as [string, ...string[]]).optional(),
  beneficiaries: z.array(z.enum([...BENEFICIARIES] as [string, ...string[]])).max(2).optional(),
  methods: z.array(z.enum([...METHODS] as [string, ...string[]])).max(3).optional(),
  stage: z.enum([...STAGES] as [string, ...string[]]).optional(),
  helpNeeded: z.array(z.enum([...HELP_NEEDED] as [string, ...string[]])).max(3).optional(),
})
  .refine(
    (data) => {
      // Require impactArea and stage when postType is 'project'
      if (data.postType === 'project') {
        return !!data.impactArea && !!data.stage;
      }
      return true;
    },
    {
      message: "impactArea and stage are required when postType is 'project'",
    }
  )
  .refine(
    (data) => {
      // Validate array lengths
      if (data.beneficiaries && data.beneficiaries.length > 2) return false;
      if (data.methods && data.methods.length > 3) return false;
      if (data.helpNeeded && data.helpNeeded.length > 3) return false;
      return true;
    },
    {
      message: "beneficiaries max 2, methods max 3, helpNeeded max 3",
    }
  );

export const CreateCommentDtoSchema = z.object({
  targetType: z.enum(["publication", "comment"]),
  targetId: z.string().min(1),
  content: z.string().max(5000),
  parentCommentId: z.string().optional(),
  images: z.array(z.string().url()).optional(),
});

export const UpdateCommentDtoSchema = z.object({
  targetType: z.enum(["publication", "comment"]).optional(),
  targetId: z.string().min(1).optional(),
  content: z.string().max(5000).optional(),
  parentCommentId: z.string().optional(),
  images: z.array(z.string().url()).optional(),
});

export const CreateVoteDtoSchema = PolymorphicReferenceSchema.extend({
  quotaAmount: z.number().int().min(0).optional(),
  walletAmount: z.number().int().min(0).optional(),
  attachedCommentId: z.string().optional(),
}).refine(
  (data) => {
    const quota = data.quotaAmount ?? 0;
    const wallet = data.walletAmount ?? 0;
    return quota > 0 || wallet > 0;
  },
  {
    message: "At least one of quotaAmount or walletAmount must be non-zero",
  }
);

// Target-less vote DTO for routes where target is implied by the URL (e.g., comments/:id/votes)
export const CreateTargetlessVoteDtoSchema = z
  .object({
    quotaAmount: z.number().int().min(0).optional(),
    walletAmount: z.number().int().min(0).optional(),
    attachedCommentId: z.string().optional(),
  })
  .refine(
    (data) => {
      const quota = data.quotaAmount ?? 0;
      const wallet = data.walletAmount ?? 0;
      return quota > 0 || wallet > 0;
    },
    {
      message: "At least one of quotaAmount or walletAmount must be non-zero",
    }
  );

export const CreatePollDtoSchema = z.object({
  communityId: z.string(),
  question: z.string().min(1).max(1000),
  description: z.string().max(2000).optional(),
  options: z
    .array(
      z.object({ id: z.string().optional(), text: z.string().min(1).max(200) })
    )
    .min(2),
  expiresAt: z.string().datetime(),
  quotaAmount: z.number().int().min(0).optional(), // Deprecated: poll creation now uses wallet merits only
  walletAmount: z.number().int().min(0).optional(), // Deprecated: server charges wallet based on pollCost
});

export const UpdatePollDtoSchema = z.object({
  communityId: z.string().optional(),
  question: z.string().min(1).max(1000).optional(),
  description: z.string().max(2000).optional(),
  options: z
    .array(
      z.object({ id: z.string().optional(), text: z.string().min(1).max(200) })
    )
    .min(2)
    .optional(),
  expiresAt: z.string().datetime().optional(),
  quotaAmount: z.number().int().min(0).optional(),
  walletAmount: z.number().int().min(0).optional(),
});

export const CreatePollCastDtoSchema = z
  .object({
    optionId: z.string(), // Changed from optionIndex to optionId
    quotaAmount: z.number().int().min(0).optional(),
    walletAmount: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      const quota = data.quotaAmount ?? 0;
      const wallet = data.walletAmount ?? 0;
      return quota > 0 || wallet > 0;
    },
    {
      message: "At least one of quotaAmount or walletAmount must be non-zero",
    }
  );

export const TransferDtoSchema = z.object({
  toUserId: z.string(),
  amount: z.number().int().min(1),
  description: z.string().optional(),
});

export const WithdrawDtoSchema = z.object({
  amount: z.number().int().min(1),
  memo: z.string().optional(),
});

export const UpdateCommunityDtoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverImageUrl: z.string().url().optional(),
  hashtags: z.array(z.string()).optional(),
  hashtagDescriptions: z.record(z.string(), z.string()).optional(),
  settings: z.object({
    iconUrl: z.string().url().optional(),
    currencyNames: CurrencySchema.optional(),
    dailyEmission: z.number().int().min(0).optional(),
    language: z.enum(["en", "ru"]).optional(),
    postCost: z.number().int().min(0).optional(),
    pollCost: z.number().int().min(0).optional(),
    forwardCost: z.number().int().min(0).optional(),
    editWindowMinutes: z.number().int().min(0).optional(),
    allowEditByOthers: z.boolean().optional(),
    canPayPostFromQuota: z.boolean().optional(),
    allowWithdraw: z.boolean().optional(),
  }).passthrough().optional(),
  votingSettings: CommunityVotingSettingsSchema.optional(),
  meritSettings: CommunityMeritSettingsSchema.optional(),
  tappalkaSettings: TappalkaSettingsSchema.partial().optional(),
  isPriority: z.boolean().optional(),
}).passthrough();

export const UpdatePublicationDtoSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  hashtags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(), // Array of category IDs
  title: z.string().min(1).max(500).optional(),
  description: z.string().min(1).max(5000).optional(),
  images: z.array(z.string().url()).optional().nullable(), // Array of image URLs - always use array, even for single image
  imageUrl: z.string().url().optional().nullable(), // For backward compatibility
  // Taxonomy fields (can be updated)
  impactArea: z.enum([...IMPACT_AREAS] as [string, ...string[]]).optional(),
  beneficiaries: z.array(z.enum([...BENEFICIARIES] as [string, ...string[]])).max(2).optional(),
  methods: z.array(z.enum([...METHODS] as [string, ...string[]])).max(3).optional(),
  stage: z.enum([...STAGES] as [string, ...string[]]).optional(),
  helpNeeded: z.array(z.enum([...HELP_NEEDED] as [string, ...string[]])).max(3).optional(),
}).strict(); // Strict mode prevents postType and isProject from being included

export const CreateCommunityDtoSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
  })
  .passthrough(); // Allow additional fields

export const VoteDirectionDtoSchema = z.object({
  amount: z.number().int(),
  direction: z.enum(["up", "down"]),
});

export const TelegramAuthDataSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number(),
  hash: z.string(),
});

export const TelegramWebAppDataSchema = z.object({
  initData: z.string(),
});

export const UpdatesFrequencySchema = z.object({
  // Allowed values must match web UI: immediate | hourly | daily | never
  frequency: z.enum(["immediate", "hourly", "daily", "never"]),
});

export const WithdrawAmountDtoSchema = z.object({
  amount: z.number().int().min(1).optional(),
});

export const VoteWithCommentDtoSchema = z.object({
  targetType: z.enum(["publication", "comment", "vote"]).optional(),
  targetId: z.string().optional(),
  quotaAmount: z.number().int().min(0).optional(),
  walletAmount: z.number().int().min(0).optional(),
  comment: z.string().optional(),
  direction: z.enum(["up", "down"]).optional(),
  images: z.array(z.string().url()).optional(),
})
  .refine(
    (data) => {
      const quota = data.quotaAmount ?? 0;
      const wallet = data.walletAmount ?? 0;
      return quota > 0 || wallet > 0;
    },
    {
      message: "At least one of quotaAmount or walletAmount must be non-zero",
    }
  );

// API Response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  meta: z
    .object({
      timestamp: z.string().datetime(),
      requestId: z.string(),
      pagination: z
        .object({
          page: z.number().int().min(1),
          pageSize: z.number().int().min(1),
          total: z.number().int().min(0),
          totalPages: z.number().int().min(0),
          hasNext: z.boolean(),
          hasPrev: z.boolean(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Generic API response schema factory
 * Creates a response schema with typed data
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string().datetime(),
        requestId: z.string(),
        pagination: z
          .object({
            page: z.number().int().min(1),
            pageSize: z.number().int().min(1),
            total: z.number().int().min(0),
            totalPages: z.number().int().min(0),
            hasNext: z.boolean(),
            hasPrev: z.boolean(),
          })
          .optional(),
      })
      .optional(),
  });
}

/**
 * Paginated response schema factory
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T
) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: z.object({
      timestamp: z.string().datetime(),
      requestId: z.string(),
      pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
  });
}

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string(),
  }),
});

// Query parameter schemas
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const SortParamsSchema = z.object({
  sort: z.enum(["score", "recent", "controversial"]).default("score"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const FilterParamsSchema = z.object({
  tag: z.string().optional(),
  communityId: z.string().optional(),
  userId: z.string().optional(),
});

export const ListQueryParamsSchema =
  PaginationParamsSchema.merge(SortParamsSchema).merge(FilterParamsSchema);

// Feed Item Schema - Unified type for publications and polls
export const FeedItemMetaSchema = z.object({
  author: z.object({
    name: z.string(),
    username: z.string().optional(),
    photoUrl: z.string().url().optional(),
  }),
  beneficiary: z
    .object({
      name: z.string(),
      username: z.string().optional(),
      photoUrl: z.string().url().optional(),
    })
    .optional(),
  origin: z
    .object({
      telegramChatName: z.string().optional(),
    })
    .optional(),
});

export const PublicationFeedItemSchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  type: z.literal("publication"),
  communityId: z.string(),
  authorId: z.string(),
  beneficiaryId: z.string().optional(),
  content: z.string().min(1),
  slug: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  postType: z.enum(["basic", "poll", "project"]).optional(),
  isProject: z.boolean().optional(),
  hashtags: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]), // Array of category IDs
  imageUrl: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  metrics: PublicationMetricsSchema,
  meta: FeedItemMetaSchema,
  permissions: ResourcePermissionsSchema.optional(),
  // Taxonomy fields for project categorization
  impactArea: z.enum([...IMPACT_AREAS] as [string, ...string[]]).optional(),
  beneficiaries: z.array(z.enum([...BENEFICIARIES] as [string, ...string[]])).optional(),
  methods: z.array(z.enum([...METHODS] as [string, ...string[]])).optional(),
  stage: z.enum([...STAGES] as [string, ...string[]]).optional(),
  helpNeeded: z.array(z.enum([...HELP_NEEDED] as [string, ...string[]])).optional(),
  deleted: z.boolean().optional().default(false),
  deletedAt: z.date().optional(),
});

export const PollFeedItemSchema = IdentifiableSchema.merge(
  TimestampsSchema
).extend({
  type: z.literal("poll"),
  communityId: z.string(),
  authorId: z.string(),
  question: z.string().min(1),
  description: z.string().optional(),
  slug: z.string().optional(),
  options: z.array(PollOptionSchema).min(2),
  expiresAt: z.string().datetime(),
  isActive: z.boolean(),
  metrics: PollMetricsSchema,
  meta: FeedItemMetaSchema,
});

export const FeedItemSchema = z.discriminatedUnion("type", [
  PublicationFeedItemSchema,
  PollFeedItemSchema,
]);

// Export types
export type Authenticator = z.infer<typeof AuthenticatorSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserCommunityRole = z.infer<typeof UserCommunityRoleSchema>;
export type Invite = z.infer<typeof InviteSchema>;
export type Community = z.infer<typeof CommunitySchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Vote = z.infer<typeof VoteSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollCast = z.infer<typeof PollCastSchema>;
export type Wallet = z.infer<typeof WalletSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;

// Export rule types
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;
export type PermissionRuleConditions = z.infer<typeof PermissionRuleConditionsSchema>;
export type ResourcePermissions = z.infer<typeof ResourcePermissionsSchema>;

export type CreatePublicationDto = z.infer<typeof CreatePublicationDtoSchema>;
export type CreateCommentDto = z.infer<typeof CreateCommentDtoSchema>;
export type UpdateCommentDto = z.infer<typeof UpdateCommentDtoSchema>;
export type CreateTargetlessVoteDto = z.infer<
  typeof CreateTargetlessVoteDtoSchema
>;
export type CreatePollDto = z.infer<typeof CreatePollDtoSchema>;
export type UpdatePollDto = z.infer<typeof UpdatePollDtoSchema>;
export type CreatePollCastDto = z.infer<typeof CreatePollCastDtoSchema>;
export type TransferDto = z.infer<typeof TransferDtoSchema>;
export type WithdrawDto = z.infer<typeof WithdrawDtoSchema>;
export type UpdateCommunityDto = z.infer<typeof UpdateCommunityDtoSchema>;
export type CreateCommunityDto = z.infer<typeof CreateCommunityDtoSchema>;
export type UpdatePublicationDto = z.infer<typeof UpdatePublicationDtoSchema>;
export type VoteDirectionDto = z.infer<typeof VoteDirectionDtoSchema>;
export type TelegramAuthData = z.infer<typeof TelegramAuthDataSchema>;
export type TelegramWebAppData = z.infer<typeof TelegramWebAppDataSchema>;
export type UpdatesFrequency = z.infer<typeof UpdatesFrequencySchema>;
export type WithdrawAmountDto = z.infer<typeof WithdrawAmountDtoSchema>;
export type VoteWithCommentDto = z.infer<typeof VoteWithCommentDtoSchema>;

export type ApiResponse<T> = z.infer<typeof ApiResponseSchema> & { data: T };
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type SortParams = z.infer<typeof SortParamsSchema>;
export type FilterParams = z.infer<typeof FilterParamsSchema>;
export type ListQueryParams = z.infer<typeof ListQueryParamsSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type PublicationFeedItem = z.infer<typeof PublicationFeedItemSchema>;
export type PollFeedItem = z.infer<typeof PollFeedItemSchema>;
