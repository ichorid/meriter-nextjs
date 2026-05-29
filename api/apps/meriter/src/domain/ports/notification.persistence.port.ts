export const NOTIFICATION_PERSISTENCE_PORT = Symbol('NOTIFICATION_PERSISTENCE_PORT');

export type NotificationType =
  | 'vote'
  | 'beneficiary'
  | 'mention'
  | 'reply'
  | 'comment'
  | 'publication'
  | 'poll'
  | 'favorite_update'
  | 'system'
  | 'quota'
  | 'forward_proposal'
  | 'team_join_request'
  | 'team_invitation'
  | 'investment_received'
  | 'investment_distributed'
  | 'post_closed_investment'
  | 'investment_pool_depleted'
  | 'post_closed'
  | 'post_ttl_warning'
  | 'post_inactivity_warning'
  | 'project_created'
  | 'ticket_assigned'
  | 'ticket_done'
  | 'ticket_assignee_declined'
  | 'ticket_accepted'
  | 'ticket_returned_for_revision'
  | 'ticket_evaluated'
  | 'project_published'
  | 'project_distributed'
  | 'project_closed'
  | 'member_joined'
  | 'member_left_project'
  | 'shares_changed'
  | 'ticket_apply'
  | 'ticket_rejection'
  | 'ob_vote_join_offer'
  | 'project_parent_link_requested'
  | 'project_parent_link_approved'
  | 'project_parent_link_rejected'
  | 'community_member_removed'
  | 'event_created'
  | 'event_invitation'
  | 'document_variant_proposed'
  | 'document_variant_not_selected'
  | 'document_variant_won'
  | 'document_variant_applied'
  | 'document_block_admin_override';

export type NotificationSource = 'user' | 'system' | 'community';

export interface NotificationMetadata {
  [key: string]: unknown;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  source: NotificationSource;
  sourceId?: string;
  metadata: NotificationMetadata;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  id: string;
  userId: string;
  type: NotificationType;
  source: NotificationSource;
  sourceId?: string;
  metadata: NotificationMetadata;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeduplicationKey {
  targetType: string;
  targetId: string;
}

export interface EditorPostDeduplicationKey {
  publicationId: string;
  editorId: string;
}

export interface VoteAggregationKey {
  publicationId: string;
}

export interface NotificationListQuery {
  userId: string;
  limit: number;
  skip: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

export interface ReplaceNotificationInput {
  source: NotificationSource;
  sourceId?: string;
  metadata: NotificationMetadata;
  title: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamJoinRequestResolutionUpdate {
  requestId: string;
  resolution: 'approved' | 'rejected' | 'withdrawn' | 'joined_via_invite';
  resolvedByUserId: string;
  resolvedByDisplayName: string;
}

/**
 * NotificationPersistencePort — BC-10 notification persistence (Phase 9 partial).
 *
 * Domain services depend on this port; Mongoose schemas and mappers live under
 * infrastructure/persistence only.
 */
export interface NotificationPersistencePort {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;

  findOldestUnreadByTarget(
    userId: string,
    type: NotificationType,
    key: NotificationDeduplicationKey,
  ): Promise<NotificationRecord | null>;

  findOldestUnreadByEditorAndPost(
    userId: string,
    type: NotificationType,
    key: EditorPostDeduplicationKey,
  ): Promise<NotificationRecord | null>;

  findOldestUnreadVoteAggregation(
    userId: string,
    key: VoteAggregationKey,
  ): Promise<NotificationRecord | null>;

  replaceNotification(
    id: string,
    input: ReplaceNotificationInput,
  ): Promise<NotificationRecord>;

  findByUser(query: NotificationListQuery): Promise<{
    items: NotificationRecord[];
    total: number;
  }>;

  countUnread(userId: string): Promise<number>;

  markAsRead(userId: string, notificationId: string): Promise<boolean>;

  markAllAsRead(userId: string): Promise<number>;

  markTeamJoinRequestResolved(params: TeamJoinRequestResolutionUpdate): Promise<number>;
}
