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
  createdAt: Date;
  updatedAt: Date;
}
