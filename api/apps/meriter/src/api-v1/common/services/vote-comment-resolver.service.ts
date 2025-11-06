import { Injectable, Logger } from '@nestjs/common';
import { CommentService } from '../../../domain/services/comment.service';
import { VoteService } from '../../../domain/services/vote.service';
import { NotFoundError } from '../../../common/exceptions/api.exceptions';

export interface VoteCommentSnapshot {
  id: string;
  targetType: string;
  targetId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolvedVoteComment {
  vote: any | null;
  snapshot: VoteCommentSnapshot;
  authorId: string;
}

/**
 * Service for resolving vote/comment data from an ID
 */
@Injectable()
export class VoteCommentResolverService {
  private readonly logger = new Logger(VoteCommentResolverService.name);

  constructor(
    private readonly voteService: VoteService,
    private readonly commentsService: CommentService,
  ) {}

  /**
   * Resolve vote or comment from an ID
   * Checks if it's a vote first, then falls back to comment
   */
  async resolve(id: string): Promise<ResolvedVoteComment> {
    // Check if this is a vote ID first (votes now contain comments directly)
    let vote = await this.voteService.getVoteById(id);
    let snapshot: VoteCommentSnapshot;
    let authorId: string;

    if (vote) {
      // This is a vote - votes now contain comments directly
      authorId = vote.userId;
      snapshot = {
        id: vote.id,
        targetType: vote.targetType,
        targetId: vote.targetId,
        authorId: vote.userId,
        content: vote.comment || '',
        createdAt: vote.createdAt,
        updatedAt: vote.createdAt,
      };
    } else {
      // Regular comment (legacy)
      const comment = await this.commentsService.getComment(id);
      if (!comment) {
        throw new NotFoundError('Comment', id);
      }

      snapshot = comment.toSnapshot();
      authorId = comment.getAuthorId.getValue();
    }

    return {
      vote,
      snapshot,
      authorId,
    };
  }
}

