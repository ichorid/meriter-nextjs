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
  /** Value tags (ценности) for MD / Projects hub posts. */
  valueTags?: string[];
  metrics: {
    upvotes: number;
    downvotes: number;
    commentCount: number;
  };
  imageUrl?: string; // Legacy single image support
  images?: string[]; // Array of image URLs for multi-image support
  videoUrl?: string;
  postType?: 'basic' | 'poll' | 'project' | 'ticket' | 'discussion' | 'event';
  isProject?: boolean;
  ticketStatus?: 'open' | 'in_progress' | 'done' | 'closed';
  isNeutralTicket?: boolean;
  applicants?: string[];
  deadline?: Date;
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
  ticketActivityLog?: Array<{
    at: Date;
    actorId: string;
    action: string;
    detail?: Record<string, unknown>;
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
  inactivityWarningNotified?: boolean;
  /** Total merits ever credited to this post (votes, author top-up, tappalka wins). Used for closingSummary.totalEarned. */
  lifetimeCredits?: number;
  /** Sprint 3: project/community source when post is on Birzha (e.g. marathon-of-good) */
  sourceEntityId?: string;
  sourceEntityType?: 'project' | 'community';
  /** Default semantic: user-authored when omitted (legacy). */
  authorKind?: 'user' | 'community';
  /** Community id when authorKind=community (Birzha source). */
  authoredCommunityId?: string;
  /** Audit: who published when authorKind=community. */
  publishedByUserId?: string;
  eventStartDate?: Date;
  eventEndDate?: Date;
  eventTime?: string;
  eventLocation?: string;
  eventAttendees?: string[];
  eventParticipants?: Array<{
    userId: string;
    attendance?: 'checked_in' | 'no_show' | null;
    attendanceUpdatedAt?: Date | null;
    attendanceUpdatedByUserId?: string | null;
  }>;
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
