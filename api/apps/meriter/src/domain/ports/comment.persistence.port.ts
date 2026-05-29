export const COMMENT_PERSISTENCE_PORT = Symbol('COMMENT_PERSISTENCE_PORT');

export interface CommentMetricsRecord {
  upvotes: number;
  downvotes: number;
  score: number;
  replyCount: number;
}

export interface CommentRecord {
  id: string;
  targetType: 'publication' | 'comment';
  targetId: string;
  authorId: string;
  content: string;
  metrics: CommentMetricsRecord;
  parentCommentId?: string;
  images?: string[];
  isAutoComment?: boolean;
  meritTransferId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentTargetQuery {
  targetType: 'publication' | 'comment';
  targetId: string;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export interface CommentRepliesQuery {
  commentId: string;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export interface CreateAutoCommentInput {
  id: string;
  targetId: string;
  authorId: string;
  content: string;
  meritTransferId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CommentPersistencePort — threaded discussion comments (V-12).
 */
export interface CommentPersistencePort {
  create(snapshot: CommentRecord): Promise<void>;

  createAutoComment(input: CreateAutoCommentInput): Promise<void>;

  findById(id: string): Promise<CommentRecord | null>;

  findByTarget(query: CommentTargetQuery): Promise<CommentRecord[]>;

  findReplies(query: CommentRepliesQuery): Promise<CommentRecord[]>;

  findByAuthor(userId: string, limit: number, skip: number): Promise<CommentRecord[]>;

  findPublicationAutoComments(publicationId: string, max: number): Promise<CommentRecord[]>;

  updateSnapshot(id: string, snapshot: CommentRecord): Promise<void>;

  updateContent(id: string, content: string, updatedAt: Date): Promise<CommentRecord | null>;

  deleteById(id: string): Promise<void>;
}
