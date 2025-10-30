import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PublicationService } from './publication.service';
import { CommentService } from './comment.service';

export interface UpdateEventItem {
  id: string;
  eventType: 'vote' | 'beneficiary';
  actor: { id: string; name: string; username?: string; avatarUrl?: string };
  targetType: 'publication' | 'comment';
  targetId: string;
  publicationId: string;
  communityId?: string;
  amount?: number;
  direction?: 'up' | 'down';
  createdAt: string;
}

@Injectable()
export class UserUpdatesService {
  private readonly logger = new Logger(UserUpdatesService.name);

  constructor(
    @InjectConnection() private readonly mongoose: Connection,
    private readonly publicationService: PublicationService,
    private readonly commentService: CommentService,
  ) {}

  async getUserUpdateEvents(userId: string, from: Date, to: Date): Promise<UpdateEventItem[]> {
    // Get user's publications
    const userPublications = await this.publicationService.getPublicationsByAuthor(userId, 1000, 0);
    const userPublicationIds = userPublications.map(p => p.getId.getValue());

    // Get user's comments
    const userComments = await this.commentService.getCommentsByAuthor(userId, 1000, 0);
    const userCommentIds = userComments.map(c => c.getId);

    // Votes on user's publications/comments within window
    const voteUpdatesRaw = (userPublicationIds.length > 0 || userCommentIds.length > 0)
      ? await this.mongoose.db.collection('votes')
          .find({
            $or: [
              ...(userPublicationIds.length > 0 ? [{ targetType: 'publication', targetId: { $in: userPublicationIds } }] : []),
              ...(userCommentIds.length > 0 ? [{ targetType: 'comment', targetId: { $in: userCommentIds } }] : []),
            ],
            userId: { $ne: userId },
            createdAt: { $gte: from, $lt: to },
          })
          .toArray()
      : [];

    // Beneficiary publications within window
    const beneficiaryPublications = await this.mongoose.db.collection('publications')
      .find({ beneficiaryId: userId, createdAt: { $gte: from, $lt: to } })
      .project({ id: 1, authorId: 1, communityId: 1, createdAt: 1 })
      .toArray();

    // Enrich votes
    const voteUpdates = await Promise.all(
      voteUpdatesRaw.map(async (vote: any) => {
        let publicationId = vote.targetId;
        let communityId: string | undefined;
        if (vote.targetType === 'publication') {
          const pub = await this.publicationService.getPublication(vote.targetId);
          if (pub) communityId = pub.getCommunityId.getValue();
        } else {
          const comment = await this.commentService.getComment(vote.targetId);
          if (comment) {
            publicationId = comment.getTargetId;
            if (comment.getTargetType === 'publication') {
              const pub = await this.publicationService.getPublication(publicationId);
              if (pub) communityId = pub.getCommunityId.getValue();
            }
          }
        }
        return {
          id: `vote-${vote._id}`,
          eventType: 'vote' as const,
          actor: { id: vote.userId, name: '', username: undefined, avatarUrl: undefined },
          targetType: vote.targetType,
          targetId: vote.targetId,
          publicationId,
          communityId,
          amount: vote.amount,
          direction: (vote.amount > 0 ? 'up' : 'down') as 'up' | 'down',
          createdAt: vote.createdAt?.toISOString?.() || new Date(vote.createdAt).toISOString(),
        };
      })
    );

    const beneficiaryUpdates = beneficiaryPublications.map((pub: any) => ({
      id: `beneficiary-${pub._id}`,
      eventType: 'beneficiary' as const,
      actor: { id: pub.authorId, name: '', username: undefined, avatarUrl: undefined },
      targetType: 'publication' as const,
      targetId: pub.id,
      publicationId: pub.id,
      communityId: pub.communityId,
      createdAt: pub.createdAt?.toISOString?.() || new Date(pub.createdAt).toISOString(),
    }));

    const all: UpdateEventItem[] = [...voteUpdates, ...beneficiaryUpdates]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Fetch actors info
    const actorIds = Array.from(new Set(all.map(x => x.actor.id)));
    if (actorIds.length > 0) {
      const actors = await this.mongoose.db
        .collection('users')
        .find({ id: { $in: actorIds } })
        .project({ id: 1, displayName: 1, username: 1, avatarUrl: 1 })
        .toArray();
      const map = new Map(actors.map((a: any) => [a.id, a]));
      all.forEach(ev => {
        const a = map.get(ev.actor.id);
        if (a) {
          ev.actor.name = a.displayName || 'Unknown';
          ev.actor.username = a.username;
          ev.actor.avatarUrl = a.avatarUrl;
        }
      });
    }
    return all;
  }
}


