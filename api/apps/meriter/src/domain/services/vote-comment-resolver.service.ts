import { Injectable } from '@nestjs/common';
import { Comment } from '../aggregates/comment/comment.entity';
import { Vote } from '../models/vote/vote.schema';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { CommentService } from './comment.service';
import { VoteService } from './vote.service';

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
  vote: Vote | null;
  comment: Comment | null;
  snapshot: VoteCommentSnapshot;
  authorId: string;
}

/**
 * Resolves vote/comment data from a shared ID space.
 * INV-14: vote lookup must precede legacy comment lookup.
 */
@Injectable()
export class VoteCommentResolverService {
  constructor(
    private readonly voteService: VoteService,
    private readonly commentsService: CommentService,
  ) {}

  /**
   * Resolve vote or comment from an ID (vote-first per INV-14).
   */
  async resolve(id: string): Promise<ResolvedVoteComment> {
    const vote = await this.voteService.getVoteById(id);

    if (vote) {
      return {
        vote,
        comment: null,
        snapshot: {
          id: vote.id,
          targetType: vote.targetType,
          targetId: vote.targetId,
          authorId: vote.userId,
          content: vote.comment || '',
          createdAt: vote.createdAt,
          updatedAt: vote.createdAt,
        },
        authorId: vote.userId,
      };
    }

    const comment = await this.commentsService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    return {
      vote: null,
      comment,
      snapshot: comment.toSnapshot(),
      authorId: comment.getAuthorId.getValue(),
    };
  }
}
