import {
  NotificationRoutingSchema,
  NotificationTypeSchema,
  type NotificationRoutingRow,
  type NotificationType,
} from '@meriter/shared-types/schemas/notifications';

/**
 * Interim subtitle/link matrix extracted from NotificationsClient.tsx +
 * notificationClientFormat.ts + NotificationService.buildRedirectUrl (inv-25 Track B).
 *
 * subtitleKey — rendering template id (structured JSX branch or formatNotificationMessage key).
 * linkPattern — deep-link template id (buildRedirectUrl / handleNotificationClick).
 */
export const NOTIFICATION_CLIENT_LEGACY_MATRIX: Record<
  NotificationType,
  Pick<NotificationRoutingRow, 'subtitleKey' | 'linkPattern'>
> = {
  vote: { subtitleKey: 'structured.vote', linkPattern: 'community.post' },
  beneficiary: {
    subtitleKey: 'message.createdPostWithYouAsBeneficiary',
    linkPattern: 'community.members',
  },
  mention: { subtitleKey: 'message.default', linkPattern: 'community.post' },
  reply: { subtitleKey: 'message.default', linkPattern: 'community.post.highlight' },
  comment: { subtitleKey: 'message.default', linkPattern: 'community.post.highlight' },
  publication: { subtitleKey: 'message.editedPost', linkPattern: 'community.members' },
  poll: { subtitleKey: 'message.default', linkPattern: 'community.poll' },
  favorite_update: {
    subtitleKey: 'message.favoriteUpdate',
    linkPattern: 'community.postOrPoll',
  },
  system: {
    subtitleKey: 'structured.system',
    linkPattern: 'project.orCommunity.inviteTarget',
  },
  quota: { subtitleKey: 'message.dailyQuotaReset', linkPattern: 'community' },
  forward_proposal: {
    subtitleKey: 'message.forwardProposal',
    linkPattern: 'community.post.highlight',
  },
  team_join_request: {
    subtitleKey: 'structured.teamJoinRequest',
    linkPattern: 'project.orCommunity.members',
  },
  team_invitation: {
    subtitleKey: 'structured.teamInvitation',
    linkPattern: 'project.orCommunity.inviteTarget',
  },
  investment_received: {
    subtitleKey: 'structured.investmentReceived',
    linkPattern: 'community.post',
  },
  investment_distributed: {
    subtitleKey: 'message.authorWithdrewYourShare',
    linkPattern: 'community.post',
  },
  post_closed_investment: {
    subtitleKey: 'message.postClosedInvestment',
    linkPattern: 'community.post',
  },
  investment_pool_depleted: {
    subtitleKey: 'message.investmentPoolDepleted',
    linkPattern: 'community.post',
  },
  post_closed: {
    subtitleKey: 'message.postClosedAuthorReceived',
    linkPattern: 'community.post',
  },
  post_ttl_warning: {
    subtitleKey: 'message.postTtlWarning',
    linkPattern: 'community.post',
  },
  post_inactivity_warning: {
    subtitleKey: 'message.postInactivityWarning',
    linkPattern: 'community.post',
  },
  project_created: {
    subtitleKey: 'message.projectCreated',
    linkPattern: 'project',
  },
  ticket_assigned: {
    subtitleKey: 'structured.ticketAssigned',
    linkPattern: 'project.ticket',
  },
  ticket_done: { subtitleKey: 'structured.ticketDone', linkPattern: 'project.ticket' },
  ticket_assignee_declined: {
    subtitleKey: 'structured.ticketAssigneeDeclined',
    linkPattern: 'project.ticket',
  },
  ticket_accepted: {
    subtitleKey: 'structured.ticketAccepted',
    linkPattern: 'project.ticket',
  },
  ticket_returned_for_revision: {
    subtitleKey: 'structured.ticketReturnedForRevision',
    linkPattern: 'project.ticket',
  },
  ticket_evaluated: { subtitleKey: 'message.raw', linkPattern: 'project.ticket' },
  project_published: {
    subtitleKey: 'message.projectPublished',
    linkPattern: 'birzha.post',
  },
  project_distributed: {
    subtitleKey: 'structured.projectDistributed',
    linkPattern: 'project',
  },
  project_closed: { subtitleKey: 'message.projectClosed', linkPattern: 'project' },
  member_joined: { subtitleKey: 'message.memberJoined', linkPattern: 'project' },
  member_left_project: {
    subtitleKey: 'message.memberLeftProject',
    linkPattern: 'project',
  },
  shares_changed: {
    subtitleKey: 'message.projectSharesUpdated',
    linkPattern: 'project',
  },
  ticket_apply: { subtitleKey: 'structured.ticketApply', linkPattern: 'project.ticket' },
  ticket_rejection: {
    subtitleKey: 'structured.ticketRejection',
    linkPattern: 'project.ticket',
  },
  ob_vote_join_offer: {
    subtitleKey: 'message.obVoteJoinOffer',
    linkPattern: 'community.post',
  },
  project_parent_link_requested: {
    subtitleKey: 'structured.projectParentLinkRequested',
    linkPattern: 'community.projects',
  },
  project_parent_link_approved: {
    subtitleKey: 'message.projectParentLinkApproved',
    linkPattern: 'project',
  },
  project_parent_link_rejected: {
    subtitleKey: 'message.projectParentLinkRejected',
    linkPattern: 'project',
  },
  community_member_removed: {
    subtitleKey: 'structured.communityMemberRemoved',
    linkPattern: 'project.orCommunity.inviteTarget',
  },
  event_created: {
    subtitleKey: 'message.default',
    linkPattern: 'community.postOrProject',
  },
  event_invitation: {
    subtitleKey: 'message.default',
    linkPattern: 'community.postOrProject',
  },
  document_variant_proposed: {
    subtitleKey: 'structured.documentVariant',
    linkPattern: 'community.document.block',
  },
  document_variant_not_selected: {
    subtitleKey: 'structured.documentVariant',
    linkPattern: 'community.document',
  },
  document_variant_won: {
    subtitleKey: 'structured.documentVariant',
    linkPattern: 'community.document.block',
  },
  document_variant_applied: {
    subtitleKey: 'structured.documentVariant',
    linkPattern: 'community.document.block',
  },
  document_block_admin_override: {
    subtitleKey: 'structured.documentVariant',
    linkPattern: 'community.document.block',
  },
};

/** Canonical routing rows — Phase 1 stub aligned to legacy client matrix. */
export const NOTIFICATION_ROUTING_ROWS: NotificationRoutingRow[] =
  NotificationTypeSchema.options.map((type) => ({
    type,
    ...NOTIFICATION_CLIENT_LEGACY_MATRIX[type],
  }));

/** Parsed shared-types contract (Track A). */
export const NOTIFICATION_ROUTING_MATRIX: NotificationRoutingRow[] =
  NotificationRoutingSchema.parse(NOTIFICATION_ROUTING_ROWS);

/** Track B — assert routing-matrix matches NotificationsClient interim matrix. */
export function assertNotificationRoutingParity(): void {
  for (const type of NotificationTypeSchema.options) {
    const row = NOTIFICATION_ROUTING_MATRIX.find((entry) => entry.type === type);
    const legacy = NOTIFICATION_CLIENT_LEGACY_MATRIX[type];
    if (!row) {
      throw new Error(`NotificationRoutingSchema missing row for type "${type}"`);
    }
    if (row.subtitleKey !== legacy.subtitleKey) {
      throw new Error(
        `subtitleKey parity mismatch for "${type}": matrix="${row.subtitleKey}" legacy="${legacy.subtitleKey}"`,
      );
    }
    if (row.linkPattern !== legacy.linkPattern) {
      throw new Error(
        `linkPattern parity mismatch for "${type}": matrix="${row.linkPattern}" legacy="${legacy.linkPattern}"`,
      );
    }
  }
}
