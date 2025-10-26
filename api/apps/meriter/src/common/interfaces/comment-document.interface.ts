export interface CommentDocument {
  id: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  authorId: string;
  content: string;
  metrics: {
    upvotes: number;
    downvotes: number;
    replyCount: number;
    score: number;
  };
  parentCommentId?: string;
  createdAt: Date;
  updatedAt: Date;
}
