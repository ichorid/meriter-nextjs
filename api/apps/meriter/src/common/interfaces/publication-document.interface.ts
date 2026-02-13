/**
 * Base interface for publication data structures
 */
export interface PublicationDocument {
  id: string;
  communityId: string;
  authorId: string;
  beneficiaryId?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  hashtags: string[];
  categories?: string[]; // Array of category IDs
  metrics: {
    upvotes: number;
    downvotes: number;
    commentCount: number;
  };
  imageUrl?: string; // Legacy single image support
  images?: string[]; // Array of image URLs for multi-image support
  videoUrl?: string;
  postType?: 'basic' | 'poll' | 'project';
  isProject?: boolean;
  title?: string;
  description?: string;
  // Taxonomy fields for project categorization
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
  // Forward fields
  forwardStatus?: 'pending' | 'forwarded' | null;
  forwardTargetCommunityId?: string;
  forwardProposedBy?: string;
  forwardProposedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
  editHistory?: Array<{
    editedBy: string;
    editedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  // Investment fields
  investingEnabled?: boolean;
  investorSharePercent?: number;
  investmentPool?: number;
  investmentPoolTotal?: number;
  investments?: Array<{
    investorId: string;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  // Post advanced settings (TTL, tappalka)
  ttlDays?: 7 | 14 | 30 | 60 | 90 | null;
  ttlExpiresAt?: Date | null;
  stopLoss?: number;
  noAuthorWalletSpend?: boolean;
  // Post lifecycle (D-1: status and closing)
  status?: 'active' | 'closed';
  closedAt?: Date | null;
  closeReason?: 'manual' | 'ttl' | 'inactive' | 'negative_rating' | null;
  closingSummary?: {
    totalEarned: number;
    distributedToInvestors: number;
    authorReceived: number;
    spentOnShows: number;
    poolReturned: number;
  } | null;
  lastEarnedAt?: Date | null;
  ttlWarningNotified?: boolean;
}

/**
 * Publication snapshot with optional calculated score
 * Extends PublicationDocument with score field in metrics
 */
export interface PublicationSnapshot extends PublicationDocument {
  metrics: PublicationDocument['metrics'] & {
    score?: number; // Optional since it can be calculated
  };
}
