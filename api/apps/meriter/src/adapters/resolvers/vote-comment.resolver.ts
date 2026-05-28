import { Injectable } from '@nestjs/common';
import { Comment } from '../../domain/aggregates/comment/comment.entity';
import { Vote } from '../../domain/models/vote/vote.schema';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { CommentService } from '../../domain/services/comment.service';
import { VoteService } from '../../domain/services/vote.service';
import {
  ResolvedVoteComment,
  VoteCommentResolverService,
  VoteCommentSnapshot,
} from '../../domain/services/vote-comment-resolver.service';

export type { ResolvedVoteComment, VoteCommentSnapshot };

export interface ResolvedVoteCommentEntity {
  entity: Vote | Comment;
  authorId: string;
  vote: Vote | null;
  comment: Comment | null;
}

/**
 * Adapter-boundary resolver for vote/comment shared IDs (BC-04, BC-18).
 * INV-14: all comment ID bridges must resolve votes before legacy comments.
 */
@Injectable()
export class VoteCommentResolver {
  constructor(
    private readonly voteCommentResolverService: VoteCommentResolverService,
  ) {}

  /**
   * Build resolver from tRPC context services (read paths before Nest DI wiring).
   */
  static fromTrpcContext(ctx: {
    voteService: VoteService;
    commentService: CommentService;
  }): VoteCommentResolver {
    return new VoteCommentResolver(
      new VoteCommentResolverService(ctx.voteService, ctx.commentService),
    );
  }

  /**
   * Resolve vote or comment from an ID (vote-first per INV-14).
   */
  resolve(id: string): Promise<ResolvedVoteComment> {
    return this.voteCommentResolverService.resolve(id);
  }

  /**
   * Resolve the domain entity for read paths such as comments.getById.
   * Enforces INV-14 vote-first ordering via the domain resolver.
   */
  async resolveEntity(id: string): Promise<ResolvedVoteCommentEntity> {
    const resolved = await this.resolve(id);
    const entity = resolved.vote ?? resolved.comment;

    if (!entity) {
      throw new NotFoundError('Comment', id);
    }

    return {
      entity,
      authorId: resolved.authorId,
      vote: resolved.vote,
      comment: resolved.comment,
    };
  }
}
