export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
  profile: {
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Community {
  id: string;
  telegramChatId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  administrators: string[];
  members: string[];
  settings: {
    iconUrl?: string;
    currencyNames: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission: number;
  };
  hashtags: string[];
  spaces: string[];
  isAdmin: boolean;
  needsSetup: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  communityId: string;
  slug: string;
  name: string;
  description?: string;
  hashtags: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateCommunityDto {
  name?: string;
  description?: string;
  hashtags?: string[];
  settings?: {
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
}

export interface UpdateSpaceDto {
  name?: string;
  description?: string;
  hashtags?: string[];
  isActive?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
  content: string;
  metrics: {
    upvotes: number;
    downvotes: number;
    score: number;
    replyCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentDto {
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
  content: string;
}

export interface Publication {
  id: string;
  authorId: string;
  communityId: string;
  spaceId?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'poll';
  beneficiaryId?: string;
  hashtags: string[];
  imageUrl?: string;
  videoUrl?: string;
  metadata?: {
    pollData?: any;
  };
  metrics: {
    upvotes: number;
    downvotes: number;
    upthanks: number;
    downthanks: number;
    score: number;
    commentCount: number;
    viewCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  userId: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  direction: 'up' | 'down';
  sourceType?: 'personal' | 'quota';
  communityId?: string;
  createdAt: string;
}

export interface Poll {
  id: string;
  authorId: string;
  communityId: string;
  question: string;
  description?: string;
  options: { id: string; text: string; votes: number; voterCount: number }[];
  expiresAt: string;
  isActive: boolean;
  metrics?: {
    totalVotes: number;
    voterCount: number;
    totalAmount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PollVote {
  id: string;
  pollId: string;
  userId: string;
  optionId: string;
  optionIndex: number;
  amount: number;
  communityId?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  userId: string;
  communityId: string;
  balance: number;
  currency: {
    singular: string;
    plural: string;
    genitive: string;
  };
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVoteDto {
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  sourceType?: 'personal' | 'quota';
}

export interface CreatePollDto {
  communityId: string;
  question: string;
  description?: string;
  options: { text: string }[];
  expiresAt: string;
}

export interface CreatePollVoteDto {
  pollId: string;
  optionId: string;
  optionIndex: number;
  amount: number;
  communityId?: string;
}

export interface Vote {
  id: string;
  userId: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  amount: number;
  comment?: string;
  description?: string;
  sourceType?: 'personal' | 'quota';
  vote?: any;
  wallet?: any;
  createdAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  userId?: string;
  communityId?: string;
  type: string;
  amount: number;
  sourceType?: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface CreatePublicationDto {
  communityId: string;
  content: string;
  type: 'text' | 'image' | 'video';
  beneficiaryId?: string;
  hashtags: string[];
  imageUrl?: string;
  videoUrl?: string;
}

export interface CreateVoteDto {
  amount: number;
  comment?: string;
  targetType?: 'publication' | 'comment';
  targetId?: string;
}