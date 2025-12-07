import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { EventBus } from '../events/event-bus';
import {
  PublicationCreatedEvent,
  PublicationVotedEvent,
  CommentVotedEvent,
} from '../events';
import { NotificationService, CreateNotificationDto } from './notification.service';
import { PublicationService } from './publication.service';
import { VoteService } from './vote.service';
import { UserService } from './user.service';

@Injectable()
export class NotificationHandlersService implements OnModuleInit {
  private readonly logger = new Logger(NotificationHandlersService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => PublicationService))
    private readonly publicationService: PublicationService,
    @Inject(forwardRef(() => VoteService))
    private readonly voteService: VoteService,
    private readonly userService: UserService,
    @InjectConnection() private readonly mongoose: Connection,
  ) {}

  onModuleInit() {
    // Subscribe to domain events
    this.eventBus.subscribe('PublicationCreated', (event) =>
      this.handlePublicationCreated(event as PublicationCreatedEvent),
    );
    this.eventBus.subscribe('PublicationVoted', (event) =>
      this.handlePublicationVoted(event as PublicationVotedEvent),
    );
    this.eventBus.subscribe('CommentVoted', (event) =>
      this.handleCommentVoted(event as CommentVotedEvent),
    );

    this.logger.log('Notification handlers registered');
  }

  async handlePublicationCreated(event: PublicationCreatedEvent): Promise<void> {
    try {
      const publicationId = event.getAggregateId();
      const authorId = event.getAuthorId();
      const communityId = event.getCommunityId();

      // Get publication to check for beneficiary
      const publication = await this.publicationService.getPublication(publicationId);
      if (!publication) {
        this.logger.warn(`Publication ${publicationId} not found for notification`);
        return;
      }

      const beneficiaryIdVo = publication.getBeneficiaryId;
      if (!beneficiaryIdVo || beneficiaryIdVo.getValue() === authorId) {
        // No beneficiary or beneficiary is the author - no notification needed
        return;
      }
      const beneficiaryId = beneficiaryIdVo.getValue();

      // Get author info for notification message
      const author = await this.userService.getUser(authorId);
      const authorName = author?.displayName || 'Someone';

      // Create beneficiary notification
      const notificationDto: CreateNotificationDto = {
        userId: beneficiaryId,
        type: 'beneficiary',
        source: 'user',
        sourceId: authorId,
        metadata: {
          publicationId,
          communityId,
          authorId,
        },
        title: 'New publication',
        message: `${authorName} created a post with you as beneficiary`,
      };

      await this.notificationService.createNotification(notificationDto);
      this.logger.log(
        `Created beneficiary notification for user ${beneficiaryId} from publication ${publicationId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling PublicationCreated event:`, error);
    }
  }

  async handlePublicationVoted(event: PublicationVotedEvent): Promise<void> {
    try {
      const publicationId = event.getAggregateId();
      const voterId = event.getVoterId();
      const amount = event.getAmount();
      const direction = event.getDirection();

      // Get publication to find author
      const publication = await this.publicationService.getPublication(publicationId);
      if (!publication) {
        this.logger.warn(`Publication ${publicationId} not found for notification`);
        return;
      }

      const authorId = publication.getAuthorId.getValue();
      const communityId = publication.getCommunityId.getValue();

      // Don't notify if user voted on their own content
      if (authorId === voterId) {
        return;
      }

      // Get voter info for notification message
      const voter = await this.userService.getUser(voterId);
      const voterName = voter?.displayName || 'Someone';

      // Build notification message
      const action = direction === 'up' ? 'upvoted' : 'downvoted';
      const amountStr = amount ? ` (${direction === 'up' ? '+' : '-'}${Math.abs(amount)})` : '';
      const message = `${voterName} ${action} your post${amountStr}`;

      // Get the vote to find targetId (for metadata)
      const votes = await this.mongoose.db
        .collection('votes')
        .find({
          userId: voterId,
          targetType: 'publication',
          targetId: publicationId,
        })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      const voteId = votes.length > 0 ? votes[0].id : undefined;

      const notificationDto: CreateNotificationDto = {
        userId: authorId,
        type: 'vote',
        source: 'user',
        sourceId: voterId,
        metadata: {
          publicationId,
          communityId,
          targetType: 'publication',
          targetId: publicationId,
          voteId,
          amount,
          direction,
        },
        title: 'New vote',
        message,
      };

      await this.notificationService.createNotification(notificationDto);
      this.logger.log(
        `Created vote notification for user ${authorId} from vote on publication ${publicationId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling PublicationVoted event:`, error);
    }
  }

  async handleCommentVoted(event: CommentVotedEvent): Promise<void> {
    try {
      const commentId = event.getAggregateId(); // This is actually the vote ID (targetId)
      const voterId = event.getVoterId();
      const amount = event.getAmount();
      const direction = event.getDirection();

      // Get the vote to find the target (which is another vote/comment)
      const vote = await this.voteService.getVoteById(commentId);
      if (!vote) {
        this.logger.warn(`Vote ${commentId} not found for notification`);
        return;
      }

      // The vote is on another vote (comment), so we need to find the author of that vote
      const targetVoteId = vote.targetId;
      const targetVote = await this.voteService.getVoteById(targetVoteId);
      if (!targetVote) {
        this.logger.warn(`Target vote ${targetVoteId} not found for notification`);
        return;
      }

      const commentAuthorId = targetVote.userId;

      // Don't notify if user voted on their own comment
      if (commentAuthorId === voterId) {
        return;
      }

      // Traverse vote chain to find root publication
      let currentVote = targetVote;
      let depth = 0;
      let publicationId: string | undefined;
      let communityId: string | undefined;

      while (currentVote.targetType === 'vote' && depth < 20) {
        currentVote = await this.voteService.getVoteById(currentVote.targetId);
        if (!currentVote) break;
        depth++;
      }

      if (currentVote && currentVote.targetType === 'publication') {
        publicationId = currentVote.targetId;
        const pub = await this.publicationService.getPublication(publicationId);
        if (pub) {
          communityId = pub.getCommunityId.getValue();
        }
      }

      if (!publicationId || !communityId) {
        this.logger.warn(
          `Could not find publication for comment vote notification (voteId: ${commentId})`,
        );
        return;
      }

      // Get voter info for notification message
      const voter = await this.userService.getUser(voterId);
      const voterName = voter?.displayName || 'Someone';

      // Build notification message
      const action = direction === 'up' ? 'upvoted' : 'downvoted';
      const amountStr = amount ? ` (${direction === 'up' ? '+' : '-'}${Math.abs(amount)})` : '';
      const message = `${voterName} ${action} your comment${amountStr}`;

      const notificationDto: CreateNotificationDto = {
        userId: commentAuthorId,
        type: 'vote',
        source: 'user',
        sourceId: voterId,
        metadata: {
          publicationId,
          communityId,
          targetType: 'vote',
          targetId: targetVoteId,
          commentId: targetVoteId,
          voteId: commentId,
          amount,
          direction,
        },
        title: 'New vote',
        message,
      };

      await this.notificationService.createNotification(notificationDto);
      this.logger.log(
        `Created vote notification for user ${commentAuthorId} from vote on comment ${targetVoteId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling CommentVoted event:`, error);
    }
  }
}

