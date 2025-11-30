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
  metrics: {
    upvotes: number;
    downvotes: number;
    commentCount: number;
  };
  imageUrl?: string;
  videoUrl?: string;
  postType?: 'basic' | 'poll' | 'project';
  isProject?: boolean;
  title?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
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
