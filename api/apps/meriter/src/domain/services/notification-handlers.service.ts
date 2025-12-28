import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { EventBus } from '../events/event-bus';
import {
  PublicationCreatedEvent,
  PublicationUpdatedEvent,
  PublicationVotedEvent,
  CommentAddedEvent,
  CommentVotedEvent,
  PollCastedEvent,
} from '../events';
import { NotificationService, CreateNotificationDto } from './notification.service';
import { PublicationService } from './publication.service';
import { VoteService } from './vote.service';
import { UserService } from './user.service';
import { PollService } from './poll.service';
import { FavoriteService } from './favorite.service';
import type { Vote } from '../models/vote/vote.schema';

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
    @Inject(forwardRef(() => PollService))
    private readonly pollService: PollService,
    private readonly favoriteService: FavoriteService,
    @InjectConnection() private readonly mongoose: Connection,
  ) {}

  onModuleInit() {
    // Subscribe to domain events
    this.eventBus.subscribe('PublicationCreated', (event) =>
      this.handlePublicationCreated(event as PublicationCreatedEvent),
    );
    this.eventBus.subscribe('PublicationUpdated', (event) =>
      this.handlePublicationUpdated(event as PublicationUpdatedEvent),
    );
    this.eventBus.subscribe('PublicationVoted', (event) =>
      this.handlePublicationVoted(event as PublicationVotedEvent),
    );
    this.eventBus.subscribe('CommentAdded', (event) =>
      this.handleCommentAdded(event as CommentAddedEvent),
    );
    this.eventBus.subscribe('CommentVoted', (event) =>
      this.handleCommentVoted(event as CommentVotedEvent),
    );
    this.eventBus.subscribe('PollCasted', (event) =>
      this.handlePollCasted(event as PollCastedEvent),
    );

    this.logger.log('Notification handlers registered');
  }

  private async notifyFavoriteUpdate(params: {
    actorId: string;
    userIds: string[];
    targetType: 'publication' | 'poll' | 'project';
    targetId: string;
    communityId: string;
    publicationId?: string;
    pollId?: string;
    message: string;
  }): Promise<void> {
    const actor = await this.userService.getUser(params.actorId);
    const actorName = actor?.displayName || 'Someone';

    await Promise.all(
      params.userIds
        .filter((userId) => userId !== params.actorId)
        .map(async (userId) => {
          const dto: CreateNotificationDto = {
            userId,
            type: 'favorite_update',
            source: 'user',
            sourceId: params.actorId,
            metadata: {
              communityId: params.communityId,
              publicationId: params.publicationId,
              pollId: params.pollId,
              targetType: params.targetType,
              targetId: params.targetId,
            },
            title: 'Favorite updated',
            message: `${actorName} ${params.message}`,
          };

          await this.notificationService.createOrReplaceOldestUnreadByTarget(dto, {
            targetType: params.targetType,
            targetId: params.targetId,
          });
        }),
    );
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

  async handlePublicationUpdated(event: PublicationUpdatedEvent): Promise<void> {
    try {
      const publicationId = event.getAggregateId();
      const editorId = event.getEditorId();
      const authorId = event.getAuthorId();
      const communityId = event.getCommunityId();

      // Get publication to get title for notification message
      const publication = await this.publicationService.getPublication(publicationId);
      if (!publication) {
        this.logger.warn(`Publication ${publicationId} not found for notification`);
        return;
      }

      // Get editor info for notification message
      const editor = await this.userService.getUser(editorId);
      const editorName = editor?.displayName || 'Someone';

      // Get publication title for message
      const publicationSnapshot = publication.toSnapshot();
      const postTitle = publicationSnapshot.title || 'your post';

      // Create notification with deduplication
      const notificationDto: CreateNotificationDto = {
        userId: authorId,
        type: 'publication',
        source: 'user',
        sourceId: editorId,
        metadata: {
          publicationId,
          communityId,
          editorId,
          authorId,
          targetType: 'publication_edit',
          targetId: publicationId,
        },
        title: 'Post edited',
        message: `${editorName} edited ${postTitle}`,
      };

      await this.notificationService.createOrReplaceByEditorAndPost(notificationDto, {
        publicationId,
        editorId,
      });

      this.logger.log(
        `Created publication edit notification for user ${authorId} from editor ${editorId} on publication ${publicationId}`,
      );

      // Notify users who favorited this publication
      const favUserIds = await this.favoriteService.getFavoriteUserIdsForTarget(
        'publication',
        publicationId,
      );

      // Filter out editor and author (they already have notifications or don't need them)
      const usersToNotify = favUserIds.filter(
        (userId) => userId !== editorId && userId !== authorId,
      );

      await Promise.all(
        usersToNotify.map(async (userId) => {
          const favoriteNotificationDto: CreateNotificationDto = {
            userId,
            type: 'publication',
            source: 'user',
            sourceId: editorId,
            metadata: {
              publicationId,
              communityId,
              editorId,
              authorId,
              targetType: 'publication_edit',
              targetId: publicationId,
            },
            title: 'Post edited',
            message: `${editorName} edited a favorite post: ${postTitle}`,
          };

          await this.notificationService.createOrReplaceByEditorAndPost(favoriteNotificationDto, {
            publicationId,
            editorId,
          });

          this.logger.log(
            `Created publication edit notification for favoriting user ${userId} from editor ${editorId} on publication ${publicationId}`,
          );
        }),
      );
    } catch (error) {
      this.logger.error(`Error handling PublicationUpdated event:`, error);
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
      const publicationSnapshot = publication.toSnapshot();
      const isProject =
        publicationSnapshot.isProject === true || publicationSnapshot.postType === 'project';

      // Don't notify if user voted on their own content
      if (authorId === voterId) {
        // Still update favorites activity (other users may have favorited it)
        await this.favoriteService.touchFavoritesForTarget('publication', publicationId);
        if (isProject) {
          await this.favoriteService.touchFavoritesForTarget('project', publicationId);
        }
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
      const votes = await this.mongoose.db!
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

      // Favorites: mark as updated + notify favoriting users with aggregated vote notifications
      await this.favoriteService.touchFavoritesForTarget('publication', publicationId);
      const favUserIdsPublication = await this.favoriteService.getFavoriteUserIdsForTarget(
        'publication',
        publicationId,
      );

      // Filter out voter (they don't need notification for their own vote)
      const usersToNotifyPublication = favUserIdsPublication.filter((userId) => userId !== voterId);

      await Promise.all(
        usersToNotifyPublication.map(async (userId) => {
          const voteNotificationDto: CreateNotificationDto = {
            userId,
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
            message: '', // Will be set by aggregation method
          };

          await this.notificationService.createOrReplaceAndAggregateVotes(
            voteNotificationDto,
            { publicationId },
            {
              voterId,
              voterName,
              amount,
              direction,
            },
          );

          this.logger.log(
            `Created aggregated vote notification for favoriting user ${userId} on publication ${publicationId}`,
          );
        }),
      );

      if (isProject) {
        await this.favoriteService.touchFavoritesForTarget('project', publicationId);
        const favUserIdsProject = await this.favoriteService.getFavoriteUserIdsForTarget(
          'project',
          publicationId,
        );

        // Filter out voter
        const usersToNotifyProject = favUserIdsProject.filter((userId) => userId !== voterId);

        await Promise.all(
          usersToNotifyProject.map(async (userId) => {
            const voteNotificationDto: CreateNotificationDto = {
              userId,
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
              message: '', // Will be set by aggregation method
            };

            await this.notificationService.createOrReplaceAndAggregateVotes(
              voteNotificationDto,
              { publicationId },
              {
                voterId,
                voterName,
                amount,
                direction,
              },
            );

            this.logger.log(
              `Created aggregated vote notification for favoriting user ${userId} on project ${publicationId}`,
            );
          }),
        );
      }
    } catch (error) {
      this.logger.error(`Error handling PublicationVoted event:`, error);
    }
  }

  async handleCommentAdded(event: CommentAddedEvent): Promise<void> {
    try {
      const publicationId = event.getTargetId();
      const commenterId = event.getAuthorId();

      const publication = await this.publicationService.getPublication(publicationId);
      if (!publication) {
        return;
      }
      const communityId = publication.getCommunityId.getValue();
      const publicationSnapshot = publication.toSnapshot();
      const isProject =
        publicationSnapshot.isProject === true || publicationSnapshot.postType === 'project';

      await this.favoriteService.touchFavoritesForTarget('publication', publicationId);
      const favUserIdsPublication = await this.favoriteService.getFavoriteUserIdsForTarget(
        'publication',
        publicationId,
      );
      await this.notifyFavoriteUpdate({
        actorId: commenterId,
        userIds: favUserIdsPublication,
        targetType: 'publication',
        targetId: publicationId,
        communityId,
        publicationId,
        message: `commented on a favorite post`,
      });

      if (isProject) {
        await this.favoriteService.touchFavoritesForTarget('project', publicationId);
        const favUserIdsProject = await this.favoriteService.getFavoriteUserIdsForTarget(
          'project',
          publicationId,
        );
        await this.notifyFavoriteUpdate({
          actorId: commenterId,
          userIds: favUserIdsProject,
          targetType: 'project',
          targetId: publicationId,
          communityId,
          publicationId,
          message: `commented on a favorite project`,
        });
      }
    } catch (error) {
      this.logger.error(`Error handling CommentAdded event:`, error);
    }
  }

  async handlePollCasted(event: PollCastedEvent): Promise<void> {
    try {
      const pollId = event.getAggregateId();
      const casterId = event.getUserId();

      const poll = await this.pollService.getPoll(pollId);
      if (!poll) {
        return;
      }

      const snapshot = poll.toSnapshot();
      const communityId = snapshot.communityId;

      await this.favoriteService.touchFavoritesForTarget('poll', pollId);
      const favUserIds = await this.favoriteService.getFavoriteUserIdsForTarget('poll', pollId);
      await this.notifyFavoriteUpdate({
        actorId: casterId,
        userIds: favUserIds,
        targetType: 'poll',
        targetId: pollId,
        communityId,
        pollId,
        message: `voted on a favorite poll`,
      });
    } catch (error) {
      this.logger.error(`Error handling PollCasted event:`, error);
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
      let currentVote: Vote | null = targetVote;
      let depth = 0;
      let publicationId: string | undefined;
      let communityId: string | undefined;

      while (currentVote && currentVote.targetType === 'vote' && depth < 20) {
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

