import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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
  | 'event_invitation';

export type NotificationSource = 'user' | 'system' | 'community';

/**
 * Loose bag for notification payloads. Important keys by type (see `NotificationService.buildRedirectUrl`):
 * - ticket_*: ticketId, projectId, ticketTitle?, projectName?
 * - project_published: publicationId, birzhaCommunityId?, projectId, projectName?, publicationTitle?
 * - project_distributed: projectId, projectName?, amount, totalPayout?, yourAmount?, entityLabel?
 * - ob_vote_join_offer: publicationId, publicationCommunityId?, communityId (source to join), sourceCommunityName?
 * - team_join_request: requestId, communityId, communityName?, userId; when resolved: joinRequestResolution, resolvedByUserId, resolvedByDisplayName
 * - community_member_removed: communityId, communityName?, inviteTargetIsProject?
 * - event_created: communityId, publicationId, communityName?, eventTitle?, eventDateLabel?
 * - event_invitation: communityId, publicationId, communityName?, eventTitle?, senderId?
 */
export interface NotificationMetadata {
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string; // recipient
  type: NotificationType;
  source: NotificationSource;
  sourceId?: string; // ID of the source (user/community)
  metadata: NotificationMetadata;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ collection: 'notifications', timestamps: true })
export class NotificationSchemaClass implements Notification {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  userId!: string; // recipient

  @Prop({
    required: true,
    enum: ['vote', 'beneficiary', 'mention', 'reply', 'comment', 'publication', 'poll', 'favorite_update', 'system', 'quota', 'forward_proposal', 'team_join_request', 'team_invitation', 'investment_received', 'investment_distributed', 'post_closed_investment', 'investment_pool_depleted', 'post_closed', 'post_ttl_warning', 'post_inactivity_warning', 'project_created', 'ticket_assigned', 'ticket_done', 'ticket_assignee_declined', 'ticket_accepted', 'ticket_returned_for_revision', 'ticket_evaluated', 'project_published', 'project_distributed', 'project_closed', 'member_joined', 'member_left_project', 'shares_changed', 'ticket_apply', 'ticket_rejection', 'ob_vote_join_offer', 'project_parent_link_requested', 'project_parent_link_approved', 'project_parent_link_rejected', 'community_member_removed', 'event_created', 'event_invitation'],
    index: true,
  })
  type!: NotificationType;

  @Prop({
    required: true,
    enum: ['user', 'system', 'community'],
  })
  source!: NotificationSource;

  @Prop()
  sourceId?: string; // ID of the source (user/community)

  @Prop({ type: Object, required: true })
  metadata!: NotificationMetadata;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true, default: false, index: true })
  read!: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  updatedAt!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(NotificationSchemaClass);
export type NotificationDocument = NotificationSchemaClass & Document;

// Backwards-compatible runtime alias (many tests use `Notification.name`)
export const Notification = NotificationSchemaClass;

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });
