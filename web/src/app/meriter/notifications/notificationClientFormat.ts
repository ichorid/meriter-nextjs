import type { Notification, NotificationType } from '@/types/api-v1';
import { resolveSystemNoticeKind } from './notificationClientConstants';

/** next-intl `useTranslations` return shape used by notification copy helpers */
export type NotificationIntl = (
  key: string,
  values?: Record<string, string | number | boolean | undefined>,
) => string;

export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'mention':
      return '💬';
    case 'reply':
      return '↩️';
    case 'vote':
      return '👍';
    case 'invite':
      return '📨';
    case 'comment':
      return '💭';
    case 'publication':
      return '📝';
    case 'poll':
      return '📊';
    case 'system':
      return '🔔';
    case 'forward_proposal':
      return '➡️';
    case 'team_join_request':
      return '👥';
    case 'team_invitation':
      return '📨';
    case 'investment_received':
    case 'investment_distributed':
    case 'post_closed_investment':
    case 'post_closed':
      return '💰';
    case 'project_created':
    case 'project_published':
    case 'project_distributed':
    case 'project_closed':
    case 'project_parent_link_requested':
    case 'project_parent_link_approved':
    case 'project_parent_link_rejected':
      return '📁';
    case 'ticket_assigned':
    case 'ticket_done':
    case 'ticket_accepted':
    case 'ticket_returned_for_revision':
    case 'ticket_assignee_declined':
    case 'ticket_evaluated':
    case 'ticket_apply':
    case 'ticket_rejection':
      return '🎫';
    case 'ob_vote_join_offer':
      return '🤝';
    case 'member_joined':
    case 'member_left_project':
      return '👤';
    case 'community_member_removed':
      return '⛔';
    case 'shares_changed':
      return '📊';
    default:
      return '🔔';
  }
}

export function formatNotificationMessage(
  notification: Notification,
  t: NotificationIntl,
  tCommon: NotificationIntl,
): string {
  const actorName = notification.actor?.name || tCommon('someone');
  const meta = notification.metadata ?? {};

  if (notification.type === 'investment_distributed' && meta) {
    const withdrawAmount = Number(meta.withdrawAmount ?? 0);
    const share = Number(meta.amount ?? 0);
    return t('authorWithdrewYourShare', { name: actorName, amount: withdrawAmount, share });
  }
  if (notification.type === 'post_closed_investment' && meta.totalEarnings != null) {
    const total = Number(meta.totalEarnings);
    const pool = meta.poolReturned;
    const rating = meta.ratingShare;
    const projectName = meta.projectName as string | undefined;
    if (typeof pool === 'number' && typeof rating === 'number') {
      if (projectName) {
        return t('postClosedInvestmentBreakdownWithProject', {
          projectName,
          pool,
          rating,
          total,
        });
      }
      return t('postClosedInvestmentBreakdown', { pool, rating, total });
    }
    return t('postClosedInvestmentTotal', { total });
  }
  if (notification.type === 'post_closed' && meta.authorReceived != null) {
    return t('postClosedAuthorReceived', { amount: Number(meta.authorReceived) });
  }
  if (notification.type === 'favorite_update') {
    const targetType = meta.targetType as string | undefined;
    if (targetType === 'project') return t('favoriteUpdateCommentedProject', { name: actorName });
    if (targetType === 'poll') return t('favoriteUpdateVotedPoll', { name: actorName });
    return t('favoriteUpdateCommentedPost', { name: actorName });
  }
  if (notification.type === 'beneficiary') {
    return t('createdPostWithYouAsBeneficiary', { name: actorName });
  }
  if (notification.type === 'publication') {
    if (meta.targetType === 'publication_edit') {
      if (notification.message?.includes('favorite')) {
        return t('editedFavoritePost', { name: actorName });
      }
      return t('editedPost', { name: actorName });
    }
    return notification.message || '';
  }
  if (notification.type === 'team_invitation') {
    const placeName = (meta.communityName as string) ?? '';
    const note = typeof meta.inviterMessage === 'string' ? meta.inviterMessage.trim() : '';
    if (note) {
      return t('teamInvitationMessageWithComment', {
        name: actorName,
        placeName,
        comment: note,
      });
    }
    return t('teamInvitationMessage', { name: actorName, placeName });
  }
  if (notification.type === 'forward_proposal') {
    const targetName = (meta.targetCommunityName as string) ?? '';
    return t('forwardProposalMessage', { name: actorName, targetName });
  }
  if (notification.type === 'quota') {
    const count = Number(meta.amountAfter ?? meta.amount ?? 0);
    return t('dailyQuotaResetMessage', { count });
  }
  if (notification.type === 'team_join_request') {
    if (meta.joinRequestResolved === true) {
      return '';
    }
    const teamName = (meta.communityName as string) || notification.community?.name || '';
    return t('teamJoinRequestMessage', { name: actorName, teamName });
  }
  if (notification.type === 'community_member_removed') {
    return '';
  }
  if (notification.type === 'project_created') {
    const name = (meta.projectName as string) || '';
    return t('projectCreatedMessage', { name });
  }
  if (notification.type === 'project_parent_link_requested') {
    const projectName = (meta.projectName as string) || '';
    const parentName = (meta.parentName as string) || '';
    const requesterName =
      (typeof meta.requesterDisplayName === 'string' && meta.requesterDisplayName.trim()
        ? meta.requesterDisplayName.trim()
        : '') ||
      notification.actor?.name ||
      (typeof meta.requesterId === 'string' && meta.requesterId ? meta.requesterId : '') ||
      tCommon('someone');
    return t('projectParentLinkRequestedMessage', {
      projectName,
      parentName,
      requesterName,
    });
  }
  if (notification.type === 'project_parent_link_approved') {
    const projectName = (meta.projectName as string) || '';
    const parentName = (meta.parentName as string) || '';
    return t('projectParentLinkApprovedMessage', { projectName, parentName });
  }
  if (notification.type === 'project_parent_link_rejected') {
    const projectName = (meta.projectName as string) || '';
    const parentName = (meta.parentName as string) || '';
    const reason = typeof meta.reason === 'string' && meta.reason.trim() ? meta.reason.trim() : '';
    return reason
      ? t('projectParentLinkRejectedMessageWithReason', { projectName, parentName, reason })
      : t('projectParentLinkRejectedMessage', { projectName, parentName });
  }
  if (notification.type === 'project_published') {
    const name = (meta.projectName as string) || '';
    const postTitle = typeof meta.publicationTitle === 'string' ? meta.publicationTitle.trim() : '';
    if (postTitle) {
      return t('projectPublishedMessageWithPost', { name, postTitle });
    }
    return t('projectPublishedMessage', { name });
  }
  if (notification.type === 'project_distributed') {
    const name = (meta.projectName as string) || '';
    const yourAmount = Number(meta.yourAmount);
    const totalPayout = Number(meta.totalPayout ?? meta.amount ?? 0);
    if (Number.isFinite(yourAmount) && Number.isFinite(totalPayout)) {
      return t('projectDistributedMessagePersonal', {
        name,
        yourAmount,
        totalPayout,
      });
    }
    return t('projectDistributedMessage', { name });
  }
  if (notification.type === 'project_closed') {
    const name = (meta.projectName as string) || '';
    return t('projectClosedMessage', { name });
  }
  if (notification.type === 'member_joined') {
    const memberName = (meta.memberName as string) || actorName;
    const projectName = (meta.projectName as string) || notification.community?.name || '';
    return t('memberJoinedMessage', { memberName, projectName });
  }
  if (notification.type === 'member_left_project') {
    const projectName = (meta.projectName as string) || notification.community?.name || '';
    return t('memberLeftProjectMessage', { projectName });
  }
  if (notification.type === 'shares_changed') {
    const projectName = (meta.projectName as string) || notification.community?.name || '';
    if (meta.transferAdmin === true) {
      return t('projectAdminTransferredMessage', { projectName });
    }
    const pct = Number(meta.newFounderSharePercent ?? 0);
    return t('projectSharesUpdatedMessage', { projectName, percent: pct });
  }
  if (notification.type === 'ticket_assigned') {
    return '';
  }
  if (notification.type === 'ticket_apply') {
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    const applicantName =
      typeof meta.applicantName === 'string' && meta.applicantName.trim()
        ? meta.applicantName
        : actorName;
    return projectName
      ? t('ticketApplyBodyRich', { applicantName, ticketTitle, projectName })
      : t('ticketApplyBody');
  }
  if (notification.type === 'ticket_done') {
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    return projectName
      ? t('ticketDoneBodyRich', { ticketTitle, projectName })
      : t('ticketDoneBody');
  }
  if (notification.type === 'ticket_accepted') {
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    return projectName
      ? t('ticketAcceptedBodyRich', { ticketTitle, projectName })
      : t('ticketAcceptedBody');
  }
  if (notification.type === 'ticket_returned_for_revision') {
    const reason = typeof meta.reason === 'string' ? meta.reason : '';
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    return projectName
      ? t('ticketReturnedForRevisionBodyRich', { ticketTitle, projectName, reason })
      : t('ticketReturnedForRevisionBody', { reason });
  }
  if (notification.type === 'ticket_assignee_declined') {
    const reason = typeof meta.reason === 'string' ? meta.reason : '';
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    return projectName
      ? t('ticketAssigneeDeclinedBodyRich', { ticketTitle, projectName, reason })
      : t('ticketAssigneeDeclinedBody', { reason });
  }
  if (notification.type === 'ticket_rejection') {
    const custom = typeof meta.rejectionMessage === 'string' ? meta.rejectionMessage : '';
    if (custom) return custom;
    const ticketTitle =
      typeof meta.ticketTitle === 'string' && meta.ticketTitle.trim()
        ? meta.ticketTitle
        : t('untitledPost');
    const projectName =
      typeof meta.projectName === 'string' && meta.projectName.trim() ? meta.projectName : '';
    return projectName
      ? t('ticketRejectionBodyRich', { ticketTitle, projectName })
      : t('ticketRejectionDefaultBody');
  }
  if (notification.type === 'ticket_evaluated') {
    return notification.message || '';
  }
  if (notification.type === 'post_ttl_warning') {
    const postTitle = (meta.postTitle as string)?.trim() || t('untitledPost');
    return t('postTtlWarningBody', { postTitle });
  }
  if (notification.type === 'post_inactivity_warning') {
    const postTitle = (meta.postTitle as string)?.trim() || t('untitledPost');
    const days = Number(meta.inactiveCloseDays ?? 7);
    return t('postInactivityWarningBody', { postTitle, days });
  }
  if (notification.type === 'investment_pool_depleted') {
    const exited = meta.variant === 'exited_tappalka';
    if (exited) {
      return t('postExitedTappalkaBody');
    }
    return t('investmentPoolDepletedBody');
  }
  if (notification.type === 'ob_vote_join_offer') {
    const communityName =
      (typeof meta.sourceCommunityName === 'string' && meta.sourceCommunityName.trim()
        ? meta.sourceCommunityName
        : undefined) ||
      notification.community?.name ||
      (typeof meta.communityId === 'string' ? meta.communityId : '') ||
      '';
    return t('obVoteJoinOfferBody', { communityName });
  }
  if (notification.type === 'system') {
    const kind = resolveSystemNoticeKind(notification);
    if (
      kind === 'team_join_request_cancelled_by_applicant' ||
      kind === 'community_role_promoted_to_lead' ||
      kind === 'community_role_demoted_from_lead'
    ) {
      return '';
    }
    const teamName = (meta.communityName as string) || notification.community?.name || '';
    if (kind === 'team_join_approved') {
      const leadName = (meta.leadName as string) || tCommon('someone');
      return t('systemTeamJoinApprovedMessage', { leadName, teamName });
    }
    if (kind === 'team_join_rejected') {
      const leadName = (meta.leadName as string) || tCommon('someone');
      return t('systemTeamJoinRejectedMessage', { leadName, teamName });
    }
    if (kind === 'team_invitation_accepted') {
      return t('teamInvitationAcceptedMessage', {
        name: actorName,
        teamName,
      });
    }
    if (kind === 'team_invitation_rejected') {
      return t('teamInvitationRejectedMessage', {
        name: actorName,
        teamName,
      });
    }
  }
  return notification.message || '';
}

export function getNotificationTitle(
  notification: Notification,
  t: NotificationIntl,
): string {
  if (notification.type === 'vote') return t('newVote');
  if (notification.type === 'investment_received') return t('investmentReceived');
  if (notification.type === 'investment_distributed') return t('investmentDistributed');
  if (notification.type === 'post_closed_investment') {
    return notification.metadata?.projectName
      ? t('projectClosedInvestorsTitle')
      : t('postClosed');
  }
  if (notification.type === 'post_closed') return t('postClosed');
  if (notification.type === 'favorite_update') return t('favoriteUpdated');
  if (notification.type === 'beneficiary') return t('newPublication');
  if (notification.type === 'publication') return t('postEdited');
  if (notification.type === 'team_invitation') return t('teamInvitation');
  if (notification.type === 'team_join_request') return t('teamJoinRequestTitle');
  if (notification.type === 'community_member_removed') {
    return t('communityMemberRemovedTitle');
  }
  if (notification.type === 'forward_proposal') return t('forwardProposal');
  if (notification.type === 'quota') return t('dailyQuotaReset');
  if (notification.type === 'project_created') return t('projectCreatedTitle');
  if (notification.type === 'project_parent_link_requested') {
    return t('projectParentLinkRequestedTitle');
  }
  if (notification.type === 'project_parent_link_approved') {
    return t('projectParentLinkApprovedTitle');
  }
  if (notification.type === 'project_parent_link_rejected') {
    return t('projectParentLinkRejectedTitle');
  }
  if (notification.type === 'project_published') {
    const postTitle =
      typeof notification.metadata?.publicationTitle === 'string'
        ? notification.metadata.publicationTitle.trim()
        : '';
    if (postTitle) {
      const short = postTitle.length > 48 ? `${postTitle.slice(0, 45)}…` : postTitle;
      return t('projectPublishedTitleWithPost', { postTitle: short });
    }
    return t('projectPublishedTitle');
  }
  if (notification.type === 'project_distributed') {
    const projectName =
      typeof notification.metadata?.projectName === 'string'
        ? notification.metadata.projectName.trim()
        : '';
    if (projectName) {
      const short = projectName.length > 40 ? `${projectName.slice(0, 37)}…` : projectName;
      return t('projectDistributedTitleWithProject', { projectName: short });
    }
    return t('projectDistributedTitle');
  }
  if (notification.type === 'project_closed') return t('projectClosedTitle');
  if (notification.type === 'member_joined') return t('memberJoinedTitle');
  if (notification.type === 'member_left_project') return t('memberLeftTitle');
  if (notification.type === 'shares_changed') {
    return notification.metadata?.transferAdmin === true
      ? t('projectAdminTransferredTitle')
      : t('projectSharesUpdatedTitle');
  }
  if (notification.type === 'ticket_assigned') return t('ticketAssignedTitle');
  if (notification.type === 'ticket_apply') return t('ticketApplyTitle');
  if (notification.type === 'ticket_done') return t('ticketDoneTitle');
  if (notification.type === 'ticket_accepted') return t('ticketAcceptedTitle');
  if (notification.type === 'ticket_returned_for_revision') {
    return t('ticketReturnedForRevisionTitle');
  }
  if (notification.type === 'ticket_assignee_declined') {
    return t('ticketAssigneeDeclinedTitle');
  }
  if (notification.type === 'ticket_rejection') return t('ticketRejectionTitle');
  if (notification.type === 'ticket_evaluated') return t('ticketEvaluatedTitle');
  if (notification.type === 'post_ttl_warning') return t('postTtlWarningTitle');
  if (notification.type === 'post_inactivity_warning') {
    return t('postInactivityWarningTitle');
  }
  if (notification.type === 'investment_pool_depleted') {
    const exited = notification.metadata?.variant === 'exited_tappalka';
    return exited ? t('postExitedTappalkaTitle') : t('investmentPoolDepletedTitle');
  }
  if (notification.type === 'ob_vote_join_offer') return t('obVoteJoinOfferTitle');
  if (notification.type === 'system') {
    const kind = resolveSystemNoticeKind(notification);
    if (kind === 'team_join_approved') return t('systemTeamJoinApprovedTitle');
    if (kind === 'team_join_rejected') return t('systemTeamJoinRejectedTitle');
    if (kind === 'team_join_request_cancelled_by_applicant') {
      return t('systemJoinRequestWithdrawnTitle');
    }
    if (kind === 'community_role_promoted_to_lead') {
      return t('systemCommunityRolePromotedTitle');
    }
    if (kind === 'community_role_demoted_from_lead') {
      return t('systemCommunityRoleDemotedTitle');
    }
    if (kind === 'team_invitation_accepted') {
      return t('teamInvitationAccepted');
    }
    if (kind === 'team_invitation_rejected') {
      return t('teamInvitationRejected');
    }
  }
  return notification.title || '';
}
