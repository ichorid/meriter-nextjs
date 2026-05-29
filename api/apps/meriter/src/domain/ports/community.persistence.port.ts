import type { ActionType } from '../common/constants/action-types.constants';

/** Opaque persistence session handle (Mongoose ClientSession in adapter). */
export type CommunityPersistenceSession = unknown;

export const COMMUNITY_PERSISTENCE_PORT = Symbol('COMMUNITY_PERSISTENCE_PORT');

export interface CommunityCurrencyNames {
  singular: string;
  plural: string;
  genitive: string;
}

export interface CommunitySettings {
  iconUrl?: string;
  currencyNames: CommunityCurrencyNames;
  dailyEmission: number;
  language?: 'en' | 'ru';
  postCost?: number;
  pollCost?: number;
  forwardCost?: number;
  editWindowMinutes?: number;
  allowEditByOthers?: boolean;
  canPayPostFromQuota?: boolean;
  allowWithdraw?: boolean;
  forwardRule?: 'standard' | 'project';
  investingEnabled?: boolean;
  investorShareMin?: number;
  investorShareMax?: number;
  requireTTLForInvestPosts?: boolean;
  maxTTL?: number | null;
  inactiveCloseDays?: number;
  distributeAllByContractOnClose?: boolean;
  tappalkaOnlyMode?: boolean;
  commentMode?: 'all' | 'neutralOnly' | 'weightedOnly';
  eventCreation?: 'admin' | 'members';
  documentsMode?: 'off' | 'visionOrDescriptionOnly' | 'all';
  documentCreators?: 'admins' | 'members';
  documentVariantCost?: number | null;
  documentVotingDurationHours?: number;
  documentDefaultMode?: 'manual' | 'auto';
  documentAutoApplyTimerHours?: number;
}

export interface CommunityMeritConversion {
  targetCommunityId: string;
  ratio: number;
}

export interface CommunityMeritSettings {
  dailyQuota: number;
  quotaRecipients: ('superadmin' | 'lead' | 'participant')[];
  canEarn: boolean;
  canSpend: boolean;
  startingMerits?: number;
  quotaEnabled?: boolean;
}

export interface CommunityVotingSettings {
  spendsMerits: boolean;
  awardsMerits: boolean;
  meritConversion?: CommunityMeritConversion;
  votingRestriction?: 'any' | 'not-same-team';
  currencySource?: 'quota-and-wallet' | 'quota-only' | 'wallet-only';
  allowNegativeVoting?: boolean;
}

export interface CommunityTappalkaSettings {
  enabled: boolean;
  categories: string[];
  winReward: number;
  userReward: number;
  comparisonsRequired: number;
  showCost: number;
  minRating: number;
  onboardingText?: string;
}

export interface CommunityPermissionRule {
  role: 'superadmin' | 'lead' | 'participant';
  action: ActionType;
  allowed: boolean;
  conditions?: {
    requiresTeamMembership?: boolean;
    onlyTeamLead?: boolean;
    canVoteForOwnPosts?: boolean;
    participantsCannotVoteForLead?: boolean;
    canEditWithVotes?: boolean;
    canEditWithComments?: boolean;
    canEditAfterMinutes?: number;
    canDeleteWithVotes?: boolean;
    canDeleteWithComments?: boolean;
    teamOnly?: boolean;
    isHidden?: boolean;
  };
}

export interface ProjectInvestmentEntry {
  userId: string;
  amount: number;
  totalEarnings?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityFutureVisionDocumentSeed {
  sections: Array<{
    title?: string;
    order: number;
    blocks: Array<{
      order: number;
      blockType: string;
      officialContent: string;
    }>;
  }>;
}

/**
 * Community snapshot returned by persistence adapters (plain document shape).
 * Mirrors persisted community fields without coupling to Mongoose schema types.
 */
export interface CommunitySnapshot {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  members: string[];
  typeTag?:
    | 'future-vision'
    | 'marathon-of-good'
    | 'support'
    | 'team-projects'
    | 'team'
    | 'political'
    | 'housing'
    | 'volunteer'
    | 'corporate'
    | 'custom'
    | 'global'
    | 'project';
  linkedCurrencies?: string[];
  permissionRules?: CommunityPermissionRule[];
  meritSettings?: CommunityMeritSettings;
  votingSettings?: CommunityVotingSettings;
  tappalkaSettings?: CommunityTappalkaSettings;
  settings: CommunitySettings;
  hashtags: string[];
  hashtagDescriptions?: Record<string, string>;
  isActive: boolean;
  isPriority: boolean;
  lastQuotaResetAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isProject?: boolean;
  projectDuration?: 'finite' | 'ongoing';
  founderSharePercent?: number;
  investorSharePercent?: number;
  founderUserId?: string;
  parentCommunityId?: string;
  isPersonalProject?: boolean;
  projectStatus?: 'active' | 'closed' | 'archived';
  communityWalletId?: string;
  rejectionMessage?: string;
  futureVisionText?: string;
  futureVisionTags?: string[];
  futureVisionCover?: string;
  futureVisionDocumentSeed?: CommunityFutureVisionDocumentSeed;
  projectInvestments?: ProjectInvestmentEntry[];
}

export type InsertCommunityInput = CommunitySnapshot;

export interface CommunityListOptions {
  limit: number;
  skip: number;
  excludeProjects?: boolean;
}

export interface CommunityQueryListOptions {
  query: Record<string, unknown>;
  limit: number;
  skip: number;
  sort?: Record<string, 1 | -1>;
}

export interface CommunityUpdatePayload {
  set: Record<string, unknown>;
  unset?: Record<string, ''>;
}

export type CommunityArrayField = 'members' | 'hashtags';

/**
 * CommunityPersistencePort — BC-01 community persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface CommunityPersistencePort {
  startSession(): Promise<CommunityPersistenceSession>;

  findById(
    id: string,
    session?: CommunityPersistenceSession,
  ): Promise<CommunitySnapshot | null>;

  findByTypeTag(typeTag: string): Promise<CommunitySnapshot | null>;

  findAllByTypeTag(typeTag: string): Promise<CommunitySnapshot[]>;

  insertCommunity(
    community: InsertCommunityInput,
    session?: CommunityPersistenceSession,
  ): Promise<void>;

  updateCommunity(
    id: string,
    payload: CommunityUpdatePayload,
    session?: CommunityPersistenceSession,
  ): Promise<CommunitySnapshot | null>;

  resetDailyQuota(id: string, resetAt: Date): Promise<CommunitySnapshot | null>;

  deleteById(id: string): Promise<boolean>;

  addArrayItem(
    id: string,
    field: CommunityArrayField,
    value: string,
  ): Promise<CommunitySnapshot>;

  removeArrayItem(
    id: string,
    field: CommunityArrayField,
    value: string,
  ): Promise<CommunitySnapshot>;

  isUserMember(communityId: string, userId: string): Promise<boolean>;

  findAll(options: CommunityListOptions): Promise<CommunitySnapshot[]>;

  countAll(options?: Pick<CommunityListOptions, 'excludeProjects'>): Promise<number>;

  findByQuery(options: CommunityQueryListOptions): Promise<CommunitySnapshot[]>;

  countByQuery(query: Record<string, unknown>): Promise<number>;

  findByMemberUserId(userId: string): Promise<CommunitySnapshot[]>;

  findByIds(ids: string[]): Promise<CommunitySnapshot[]>;

  findManagedByIds(ids: string[]): Promise<CommunitySnapshot[]>;

  findProjectsWhereUserInvested(userId: string): Promise<CommunitySnapshot[]>;

  updateProjectInvestments(
    projectId: string,
    investments: ProjectInvestmentEntry[],
    session?: CommunityPersistenceSession,
  ): Promise<void>;

  updateManyByIds(
    ids: string[],
    set: Record<string, unknown>,
  ): Promise<number>;
}
