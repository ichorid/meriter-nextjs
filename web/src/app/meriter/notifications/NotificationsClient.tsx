'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check, CheckCheck, Filter, Settings } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { Button } from '@/components/ui/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { InfoCard } from '@/components/ui/InfoCard';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { Loader2 } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  useInfiniteNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useUpdatePreferences as useUpdatePrefs,
} from '@/hooks/api/useNotifications';
import { useAcceptTeamInvitation, useRejectTeamInvitation } from '@/hooks/api/useTeams';
import { useApproveTeamRequest, useRejectTeamRequest } from '@/hooks/api/useTeamRequests';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/constants/queryKeys';
import type { Notification, NotificationType } from '@/types/api-v1';
import { routes } from '@/lib/constants/routes';

const SYSTEM_NOTICE_TITLE_TO_KIND: Record<string, string> = {
  'Team join request approved': 'team_join_approved',
  'Team join request rejected': 'team_join_rejected',
  'Team invitation accepted': 'team_invitation_accepted',
  'Team invitation rejected': 'team_invitation_rejected',
};

function contextLabelFromMetadata(n: Notification): string | undefined {
  const m = n.metadata ?? {};
  return (
    n.community?.name ||
    (typeof m.communityName === 'string' && m.communityName.trim() ? m.communityName : undefined) ||
    (typeof m.sourceCommunityName === 'string' && m.sourceCommunityName.trim()
      ? m.sourceCommunityName
      : undefined) ||
    (typeof m.projectName === 'string' && m.projectName.trim() ? m.projectName : undefined)
  );
}

const NOTIFICATION_TYPES_WITHOUT_SEPARATE_ACTOR = new Set<NotificationType>([
  'vote',
  'investment_received',
  'investment_distributed',
  'team_join_request',
  'team_invitation',
  'community_member_removed',
  'forward_proposal',
  'favorite_update',
  'beneficiary',
  'publication',
  'quota',
  'system',
  'project_parent_link_requested',
  'project_parent_link_approved',
  'project_parent_link_rejected',
  'ticket_assigned',
  'ticket_done',
  'ticket_accepted',
  'ticket_returned_for_revision',
  'ticket_assignee_declined',
  'ticket_apply',
  'ticket_rejection',
]);

const NOTIFICATION_TYPES_HIDE_CONTEXT = new Set<NotificationType>([
  'team_invitation',
  'team_join_request',
  'community_member_removed',
  'project_parent_link_requested',
  'ticket_assigned',
  'ob_vote_join_offer',
  'project_distributed',
  'ticket_done',
  'ticket_accepted',
  'ticket_returned_for_revision',
  'ticket_assignee_declined',
  'ticket_rejection',
  'ticket_apply',
]);

function communityOrProjectHref(communityId: string, isProject: boolean): string {
  return isProject ? `/meriter/projects/${communityId}` : `/meriter/communities/${communityId}`;
}

const NOTIFICATION_TYPES_PROJECT_CONTEXT = new Set<NotificationType>([
  'project_created',
  'project_published',
  'project_distributed',
  'project_closed',
  'member_joined',
  'member_left_project',
  'shares_changed',
]);

function resolveNotificationContextHref(n: Notification): string | undefined {
  const m = n.metadata ?? {};
  const projectId = typeof m.projectId === 'string' && m.projectId.trim() ? m.projectId.trim() : undefined;
  if (projectId) {
    return routes.project(projectId);
  }
  const communityMetaId =
    typeof m.communityId === 'string' && m.communityId.trim() ? m.communityId.trim() : undefined;
  const cid = n.community?.id;
  const isProjectFlag = m.inviteTargetIsProject === true;
  const isCommunityFlag = m.inviteTargetIsProject === false;

  if (communityMetaId) {
    if (isProjectFlag) return routes.project(communityMetaId);
    if (isCommunityFlag) return routes.community(communityMetaId);
    if (NOTIFICATION_TYPES_PROJECT_CONTEXT.has(n.type)) return routes.project(communityMetaId);
    return routes.community(communityMetaId);
  }
  if (cid) {
    if (isProjectFlag) return routes.project(cid);
    if (isCommunityFlag) return routes.community(cid);
    if (NOTIFICATION_TYPES_PROJECT_CONTEXT.has(n.type)) return routes.project(cid);
    return routes.community(cid);
  }
  return undefined;
}

function buildTicketLinkParts(
  m: Record<string, unknown>,
  untitledLabel: string,
): {
  ticketHref: string;
  projectHref: string;
  ticketTitle: string;
  projectName: string;
} {
  const ticketId = typeof m.ticketId === 'string' ? m.ticketId : '';
  const projectId = typeof m.projectId === 'string' ? m.projectId : '';
  const ticketTitle =
    typeof m.ticketTitle === 'string' && m.ticketTitle.trim() ? m.ticketTitle.trim() : untitledLabel;
  const projectName =
    typeof m.projectName === 'string' && m.projectName.trim() ? m.projectName.trim() : projectId;
  const ticketHref =
    projectId && ticketId
      ? `${routes.project(projectId)}?highlight=${encodeURIComponent(ticketId)}`
      : '';
  const projectHref = projectId ? routes.project(projectId) : '';
  return { ticketHref, projectHref, ticketTitle, projectName };
}

function isTeamJoinRequestActionable(notification: Notification): boolean {
  if (notification.type !== 'team_join_request') return false;
  if (notification.read) return false;
  if (notification.metadata?.joinRequestResolved === true) return false;
  const res = notification.metadata?.joinRequestResolution as string | undefined;
  if (
    res === 'approved' ||
    res === 'rejected' ||
    res === 'withdrawn' ||
    res === 'joined_via_invite'
  ) {
    return false;
  }
  return typeof notification.metadata?.requestId === 'string';
}

function quotePlaceLabel(placeName: string, locale: string): string {
  return locale.startsWith('ru') ? `«${placeName}»` : `"${placeName}"`;
}

function resolveInviteTargetIsProject(n: Notification): boolean {
  return n.metadata?.inviteTargetIsProject === true;
}

function resolveSystemNoticeKind(n: Notification): string | undefined {
  const raw = n.metadata?.noticeKind;
  if (
    raw === 'team_join_approved' ||
    raw === 'team_join_rejected' ||
    raw === 'team_invitation_accepted' ||
    raw === 'team_invitation_rejected' ||
    raw === 'team_join_request_cancelled_by_applicant' ||
    raw === 'community_role_promoted_to_lead' ||
    raw === 'community_role_demoted_from_lead'
  ) {
    return raw;
  }
  return SYSTEM_NOTICE_TITLE_TO_KIND[n.title || ''];
}

export default function NotificationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('notifications');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const isAutoFetchingRef = useRef(false);
  const hasRefetchedOnLoadRef = useRef(false);

  const isMobile = useMediaQuery('(max-width: 640px)');
  const pageSize = isMobile ? 15 : 30; // Меньше данных на mobile

  const {
    data: notificationsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteNotifications(
    {
      unreadOnly: filter === 'unread',
      type: filter !== 'all' && filter !== 'unread' ? filter : undefined,
    },
    pageSize
  );

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const acceptInvitation = useAcceptTeamInvitation();
  const rejectInvitation = useRejectTeamInvitation();
  const approveTeamJoinRequest = useApproveTeamRequest();
  const rejectTeamJoinRequest = useRejectTeamRequest();

  // Helper function to recursively fetch all remaining pages
  const fetchAllRemainingPages = React.useCallback(async () => {
    if (isAutoFetchingRef.current || isFetchingNextPage) {
      return;
    }

    isAutoFetchingRef.current = true;

    try {
      // Keep fetching while there are more pages
      let attempts = 0;
      const maxAttempts = 100; // Safety limit

      while (attempts < maxAttempts) {
        // Check current state - wait if currently fetching
        if (isFetchingNextPage) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Check if there's a next page
        if (!hasNextPage) {
          break;
        }

        // Fetch the next page
        await fetchNextPage();
        attempts++;

        // Wait for the fetch to complete before checking again
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } finally {
      isAutoFetchingRef.current = false;
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Refetch unread count when initial notifications fetch completes
  // This ensures the indicator updates immediately after backend auto-marks notifications as read
  useEffect(() => {
    if (!isLoading && notificationsData && !hasRefetchedOnLoadRef.current) {
      // Initial load completed - backend has auto-marked notifications as read
      // Refetch unread count to update the indicator immediately
      queryClient.refetchQueries({
        queryKey: queryKeys.notifications.unreadCount(),
      });
      hasRefetchedOnLoadRef.current = true;
    }
  }, [isLoading, notificationsData, queryClient]);

  // Watch for when mutations succeed and auto-fetch remaining pages after refetch
  useEffect(() => {
    const mutationSucceeded = markAsRead.isSuccess || markAllAsRead.isSuccess;

    if (mutationSucceeded && !isAutoFetchingRef.current) {
      // First refetch the infinite query to get fresh data
      refetch().then(() => {
        // After refetch completes, wait a bit then fetch all remaining pages
        setTimeout(() => {
          fetchAllRemainingPages();
        }, 500);
      });

      // Reset mutation success flags
      if (markAsRead.isSuccess) markAsRead.reset();
      if (markAllAsRead.isSuccess) markAllAsRead.reset();
    }
  }, [markAsRead.isSuccess, markAllAsRead.isSuccess, refetch, fetchAllRemainingPages, markAsRead, markAllAsRead]);

  // Flatten notifications from all pages
  const notifications = useMemo((): Notification[] => {
    return (notificationsData?.pages ?? []).flatMap(
      (page: { data?: Notification[] }) => page.data ?? [],
    );
  }, [notificationsData?.pages]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Infinite scroll trigger
  const observerTarget = useInfiniteScroll({
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    isFetchingNextPage,
    threshold: 200,
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate({ id: notification.id });
    }
    if (notification.url) {
      router.push(notification.url);
      return;
    }
    const meta = notification.metadata ?? {};
    if (
      notification.type === 'project_parent_link_requested' &&
      typeof meta.parentCommunityId === 'string'
    ) {
      router.push(`/meriter/communities/${meta.parentCommunityId}/projects`);
      return;
    }
    if (
      (notification.type === 'project_parent_link_approved' ||
        notification.type === 'project_parent_link_rejected') &&
      typeof meta.projectId === 'string'
    ) {
      router.push(`/meriter/projects/${meta.projectId}`);
      return;
    }
    if (
      notification.type.startsWith('ticket_') &&
      typeof meta.projectId === 'string' &&
      typeof meta.ticketId === 'string'
    ) {
      router.push(`/meriter/projects/${meta.projectId}?highlight=${meta.ticketId}`);
      return;
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const getNotificationIcon = (type: NotificationType) => {
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
  };

  const tCommon = useTranslations('common');

  const formatNotificationMessage = (notification: Notification): string => {
    const actorName = notification.actor?.name || tCommon('someone');
    const meta = notification.metadata ?? {};

    if (notification.type === 'vote' && meta.direction) {
      const direction = meta.direction as 'up' | 'down';
      const amount = typeof meta.amount === 'number' ? meta.amount : 0;
      const targetType = meta.targetType === 'vote' ? 'comment' : 'post';
      const key = direction === 'up'
        ? (targetType === 'post' ? 'voteUpPost' : 'voteUpComment')
        : (targetType === 'post' ? 'voteDownPost' : 'voteDownComment');
      const base = t(key, { name: actorName });
      const amountStr = amount ? ` (${direction === 'up' ? '+' : '-'}${Math.abs(amount)})` : '';
      return base + amountStr;
    }
    if (notification.type === 'investment_received' && meta.amount != null) {
      return t('investedInYourPost', { name: actorName, amount: Number(meta.amount) });
    }
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
      const note =
        typeof meta.inviterMessage === 'string' ? meta.inviterMessage.trim() : '';
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
      const teamName =
        (meta.communityName as string) || notification.community?.name || '';
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
      const postTitle =
        typeof meta.publicationTitle === 'string' ? meta.publicationTitle.trim() : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
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
        typeof meta.projectName === 'string' && meta.projectName.trim()
          ? meta.projectName
          : '';
      return projectName
        ? t('ticketRejectionBodyRich', { ticketTitle, projectName })
        : t('ticketRejectionDefaultBody');
    }
    if (notification.type === 'ticket_evaluated') {
      return notification.message || '';
    }
    if (notification.type === 'post_ttl_warning') {
      const postTitle =
        (meta.postTitle as string)?.trim() || t('untitledPost');
      return t('postTtlWarningBody', { postTitle });
    }
    if (notification.type === 'post_inactivity_warning') {
      const postTitle =
        (meta.postTitle as string)?.trim() || t('untitledPost');
      const days = Number(meta.inactiveCloseDays ?? 7);
      return t('postInactivityWarningBody', { postTitle, days });
    }
    if (notification.type === 'investment_pool_depleted') {
      const exited =
        meta.variant === 'exited_tappalka' || notification.title === 'Post exited tappalka';
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
      const teamName =
        (meta.communityName as string) || notification.community?.name || '';
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
  };

  const getNotificationTitle = (notification: Notification): string => {
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
        const short =
          postTitle.length > 48 ? `${postTitle.slice(0, 45)}…` : postTitle;
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
        const short =
          projectName.length > 40 ? `${projectName.slice(0, 37)}…` : projectName;
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
      const exited =
        notification.metadata?.variant === 'exited_tappalka' ||
        notification.title === 'Post exited tappalka';
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
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return t('justNow');
      if (diffMins < 60) return `${diffMins}${t('minutesAgo')}`;
      if (diffHours < 24) return `${diffHours}${t('hoursAgo')}`;
      if (diffDays < 7) return `${diffDays}${t('daysAgo')}`;
      return date.toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const renderNotificationSubtitle = (notification: Notification): React.ReactNode => {
    const m = notification.metadata ?? {};
    const isProject = resolveInviteTargetIsProject(notification);

    if (notification.type === 'system') {
      const kind = resolveSystemNoticeKind(notification);
      if (
        kind === 'team_join_request_cancelled_by_applicant' ||
        kind === 'community_role_promoted_to_lead' ||
        kind === 'community_role_demoted_from_lead'
      ) {
        const actorName = notification.actor?.name || tCommon('someone');
        const actorId =
          (typeof notification.sourceId === 'string' && notification.sourceId) ||
          notification.actor?.id ||
          '';
        const communityId = typeof m.communityId === 'string' ? m.communityId : '';
        const placeName =
          (typeof m.communityName === 'string' && m.communityName) ||
          notification.community?.name ||
          '';
        const profileHref = actorId ? `/meriter/users/${actorId}` : undefined;
        const placeHref =
          communityId && placeName
            ? communityOrProjectHref(communityId, isProject)
            : undefined;

        const line1Suffix =
          kind === 'team_join_request_cancelled_by_applicant'
            ? t('systemJoinRequestWithdrawnActorSuffix')
            : kind === 'community_role_promoted_to_lead'
              ? t('systemRolePromotedActorSuffix')
              : t('systemRoleDemotedActorSuffix');

        return (
          <div className="flex flex-col gap-1">
            <div>
              {profileHref ? (
                <Link
                  href={profileHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {actorName}
                </Link>
              ) : (
                actorName
              )}
              {line1Suffix}
            </div>
            {placeName ? (
              <div>
                {placeHref ? (
                  <Link
                    href={placeHref}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {quotePlaceLabel(placeName, locale)}
                  </Link>
                ) : (
                  quotePlaceLabel(placeName, locale)
                )}
              </div>
            ) : null}
            <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
          </div>
        );
      }
    }

    if (notification.type === 'team_invitation') {
      const actorName = notification.actor?.name || tCommon('someone');
      const inviterId =
        (typeof m.inviterId === 'string' && m.inviterId) ||
        notification.actor?.id ||
        '';
      const communityId = typeof m.communityId === 'string' ? m.communityId : '';
      const placeName =
        (typeof m.communityName === 'string' && m.communityName) ||
        notification.community?.name ||
        '';
      const note =
        typeof m.inviterMessage === 'string' ? m.inviterMessage.trim() : '';

      const profileHref = inviterId ? `/meriter/users/${inviterId}` : undefined;
      const placeHref =
        communityId && placeName
          ? communityOrProjectHref(communityId, isProject)
          : undefined;

      return (
        <div className="flex flex-col gap-1">
          <div>
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {actorName}
              </Link>
            ) : (
              actorName
            )}
            {t('teamInvitationInvitedYouSuffix')}
          </div>
          {placeName ? (
            <div>
              {placeHref ? (
                <Link
                  href={placeHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {quotePlaceLabel(placeName, locale)}
                </Link>
              ) : (
                quotePlaceLabel(placeName, locale)
              )}
            </div>
          ) : null}
          {note ? (
            <div className="whitespace-pre-wrap break-words">
              <span className="text-brand-text-secondary">{t('teamInvitationCommentLabel')}</span>{' '}
              {note}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'community_member_removed') {
      const actorName = notification.actor?.name || tCommon('someone');
      const actorId =
        (typeof notification.sourceId === 'string' && notification.sourceId) ||
        notification.actor?.id ||
        '';
      const communityId = typeof m.communityId === 'string' ? m.communityId : '';
      const placeName =
        (typeof m.communityName === 'string' && m.communityName) ||
        notification.community?.name ||
        '';
      const profileHref = actorId ? `/meriter/users/${actorId}` : undefined;
      const placeHref =
        communityId && placeName
          ? communityOrProjectHref(communityId, isProject)
          : undefined;

      return (
        <div className="flex flex-col gap-1">
          <div className="flex flex-col gap-0.5">
            <div>
              {profileHref ? (
                <Link
                  href={profileHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {actorName}
                </Link>
              ) : (
                actorName
              )}
              {t('communityMemberRemovedActorSuffix')}
            </div>
            {placeName ? (
              <div>
                {placeHref ? (
                  <Link
                    href={placeHref}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {quotePlaceLabel(placeName, locale)}
                  </Link>
                ) : (
                  quotePlaceLabel(placeName, locale)
                )}
              </div>
            ) : null}
          </div>
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'team_join_request') {
      const actorName = notification.actor?.name || tCommon('someone');
      const requesterId =
        (typeof m.userId === 'string' && m.userId) || notification.actor?.id || '';
      const communityId = typeof m.communityId === 'string' ? m.communityId : '';
      const teamName =
        (typeof m.communityName === 'string' && m.communityName) ||
        notification.community?.name ||
        '';
      const applicantNote =
        typeof m.applicantMessage === 'string' ? m.applicantMessage.trim() : '';
      const resolution = m.joinRequestResolution as string | undefined;
      const isResolved =
        m.joinRequestResolved === true ||
        (typeof resolution === 'string' &&
          ['approved', 'rejected', 'withdrawn', 'joined_via_invite'].includes(resolution));
      const resolverId =
        (typeof m.resolvedByUserId === 'string' && m.resolvedByUserId.trim()
          ? m.resolvedByUserId.trim()
          : typeof m.joinRequestResolvedByUserId === 'string' &&
              m.joinRequestResolvedByUserId.trim()
            ? m.joinRequestResolvedByUserId.trim()
            : '') || '';
      const resolverName =
        (typeof m.resolvedByDisplayName === 'string' && m.resolvedByDisplayName.trim()
          ? m.resolvedByDisplayName.trim()
          : typeof m.joinRequestResolvedByName === 'string' &&
              m.joinRequestResolvedByName.trim()
            ? m.joinRequestResolvedByName.trim()
            : '') || tCommon('someone');
      const resolverHref = resolverId ? `/meriter/users/${resolverId}` : undefined;
      const decisionValue =
        resolution === 'approved'
          ? t('teamJoinRequestResolvedValueApproved')
          : resolution === 'rejected'
            ? t('teamJoinRequestResolvedValueRejected')
            : resolution === 'withdrawn'
              ? t('teamJoinRequestResolvedValueWithdrawn')
              : resolution === 'joined_via_invite'
                ? t('teamJoinRequestResolvedValueJoinedViaInvite')
                : '';

      const profileHref = requesterId ? `/meriter/users/${requesterId}` : undefined;
      const placeHref =
        communityId && teamName
          ? communityOrProjectHref(communityId, isProject)
          : undefined;

      return (
        <div className="flex flex-col gap-1">
          <div>
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {actorName}
              </Link>
            ) : (
              actorName
            )}
            {t('teamJoinRequestWantsToJoinSuffix')}
          </div>
          {teamName ? (
            <div>
              {placeHref ? (
                <Link
                  href={placeHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {quotePlaceLabel(teamName, locale)}
                </Link>
              ) : (
                quotePlaceLabel(teamName, locale)
              )}
            </div>
          ) : null}
          {applicantNote ? (
            <div className="whitespace-pre-wrap break-words">
              <span className="text-brand-text-secondary">{t('teamJoinRequestApplicantMessageLabel')}</span>{' '}
              {applicantNote}
            </div>
          ) : null}
          {isResolved ? (
            <div className="mt-1 flex flex-col gap-1.5 border-t border-base-200/80 pt-2">
              <div className="text-sm font-medium text-brand-text-primary">
                {t('teamJoinRequestResolvedHeading')}
              </div>
              <div className="text-sm text-brand-text-primary">
                <span className="text-brand-text-secondary">
                  {t('teamJoinRequestResolvedByLabel')}
                </span>{' '}
                {resolverHref ? (
                  <Link
                    href={resolverHref}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-brand-primary hover:underline"
                  >
                    {resolverName}
                  </Link>
                ) : (
                  resolverName
                )}
              </div>
              {decisionValue ? (
                <div className="text-sm text-brand-text-primary">
                  <span className="text-brand-text-secondary">
                    {t('teamJoinRequestDecisionLabel')}
                  </span>{' '}
                  {decisionValue}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'project_parent_link_requested') {
      const projectId = typeof m.projectId === 'string' ? m.projectId : '';
      const projectName =
        (typeof m.projectName === 'string' && m.projectName.trim() ? m.projectName.trim() : '') ||
        projectId;
      const parentCommunityId =
        (typeof m.parentCommunityId === 'string' && m.parentCommunityId.trim()
          ? m.parentCommunityId.trim()
          : '') || '';
      const parentName =
        (typeof m.parentName === 'string' && m.parentName.trim() ? m.parentName.trim() : '') ||
        parentCommunityId;
      const requesterId =
        (typeof m.requesterId === 'string' && m.requesterId.trim() ? m.requesterId.trim() : '') ||
        '';
      const requesterDisplayName =
        (typeof m.requesterDisplayName === 'string' && m.requesterDisplayName.trim()
          ? m.requesterDisplayName.trim()
          : '') ||
        notification.actor?.name ||
        requesterId ||
        tCommon('someone');

      const projectHref = projectId ? routes.project(projectId) : undefined;
      const parentHref = parentCommunityId ? routes.community(parentCommunityId) : undefined;
      const requesterHref = requesterId ? routes.userProfile(requesterId) : undefined;

      return (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            <span>{t('projectParentLinkRequestedProjectLabel')}</span>
            {projectHref ? (
              <Link
                href={projectHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {quotePlaceLabel(projectName, locale)}
              </Link>
            ) : (
              quotePlaceLabel(projectName, locale)
            )}
            <span>{t('projectParentLinkRequestedMiddle')}</span>
            {parentHref ? (
              <Link
                href={parentHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {quotePlaceLabel(parentName, locale)}
              </Link>
            ) : (
              quotePlaceLabel(parentName, locale)
            )}
          </div>
          <div className="text-sm text-brand-text-primary">
            <span className="text-brand-text-secondary">{t('projectParentLinkRequestedByLabel')}</span>{' '}
            {requesterHref ? (
              <Link
                href={requesterHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {requesterDisplayName}
              </Link>
            ) : (
              requesterDisplayName
            )}
          </div>
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'project_distributed') {
      const projectId = typeof m.projectId === 'string' ? m.projectId : '';
      const projectName =
        (typeof m.projectName === 'string' && m.projectName.trim()
          ? m.projectName.trim()
          : '') || projectId;
      const yourAmount = Number(m.yourAmount);
      const totalPayout = Number(m.totalPayout ?? m.amount ?? 0);
      const payoutBucket =
        typeof m.payoutBucket === 'string' && m.payoutBucket.trim() ? m.payoutBucket.trim() : '';
      const projectHref = projectId ? routes.project(projectId) : '';
      const finiteYour = Number.isFinite(yourAmount);
      const finiteTotal = Number.isFinite(totalPayout);

      return (
        <div className="flex flex-col gap-1.5">
          {finiteYour && yourAmount > 0 ? (
            <div className="text-sm text-brand-text-primary">
              {t('projectDistributedSubtitleYouReceived', { yourAmount })}
            </div>
          ) : finiteYour && yourAmount === 0 ? (
            <div className="text-sm text-brand-text-secondary">
              {t('projectDistributedSubtitleMemberNoCredits')}
            </div>
          ) : null}
          {finiteTotal && totalPayout > 0 ? (
            <div className="text-sm text-brand-text-primary">
              {t('projectDistributedSubtitleTotal', { totalPayout })}
            </div>
          ) : null}
          {payoutBucket ? (
            <div className="text-xs text-brand-text-secondary">
              {t('projectDistributedSubtitleBucket', { bucket: payoutBucket })}
            </div>
          ) : null}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_assigned') {
      const ticketId = typeof m.ticketId === 'string' ? m.ticketId : '';
      const projectId = typeof m.projectId === 'string' ? m.projectId : '';
      const ticketTitle =
        typeof m.ticketTitle === 'string' && m.ticketTitle.trim()
          ? m.ticketTitle.trim()
          : t('untitledPost');
      const projectName =
        (typeof m.projectName === 'string' && m.projectName.trim()
          ? m.projectName.trim()
          : '') || projectId;
      const assignerId =
        (typeof m.assignedByUserId === 'string' && m.assignedByUserId.trim()) ||
        (typeof m.leadUserId === 'string' && m.leadUserId.trim()) ||
        '';
      const assignerName =
        (typeof m.assignedByDisplayName === 'string' && m.assignedByDisplayName.trim()) ||
        notification.actor?.name ||
        (assignerId ? assignerId : tCommon('someone'));

      const ticketHref =
        projectId && ticketId
          ? `${routes.project(projectId)}?highlight=${encodeURIComponent(ticketId)}`
          : '';
      const projectHref = projectId ? routes.project(projectId) : '';
      const assignerHref = assignerId ? routes.userProfile(assignerId) : undefined;
      const hasAssigner =
        Boolean(assignerId) ||
        (typeof m.assignedByDisplayName === 'string' &&
          m.assignedByDisplayName.trim().length > 0) ||
        Boolean(notification.actor?.id);

      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col gap-1">
            {ticketHref ? (
              <Link
                href={ticketHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline break-words"
              >
                {quotePlaceLabel(ticketTitle, locale)}
              </Link>
            ) : (
              <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
            )}
            {projectHref ? (
              <Link
                href={projectHref}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-brand-primary hover:underline break-words"
              >
                {quotePlaceLabel(projectName, locale)}
              </Link>
            ) : (
              <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
            )}
          </div>
          {hasAssigner ? (
            <div className="text-sm text-brand-text-primary">
              <span className="text-brand-text-secondary">{t('ticketAssignedByLabel')}</span>{' '}
              {assignerHref ? (
                <Link
                  href={assignerHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-brand-primary hover:underline"
                >
                  {assignerName}
                </Link>
              ) : (
                assignerName
              )}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_apply') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const actorName = notification.actor?.name || tCommon('someone');
      const actorId = notification.actor?.id ?? '';
      const actorHref = actorId ? routes.userProfile(actorId) : undefined;

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyApplyStatus')}</div>
          <div className="text-sm text-brand-text-primary">
            {actorHref ? (
              <Link
                href={actorHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {actorName}
              </Link>
            ) : (
              actorName
            )}{' '}
            <span className="text-brand-text-secondary">{t('ticketNotifyApplyWording')}</span>
          </div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_done') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const actorId =
        (typeof m.beneficiaryId === 'string' && m.beneficiaryId.trim()
          ? m.beneficiaryId.trim()
          : '') || notification.sourceId || notification.actor?.id || '';
      const actorName =
        (typeof m.beneficiaryDisplayName === 'string' && m.beneficiaryDisplayName.trim()
          ? m.beneficiaryDisplayName.trim()
          : '') ||
        notification.actor?.name ||
        tCommon('someone');
      const actorHref = actorId ? routes.userProfile(actorId) : undefined;

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyDoneStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-sm text-brand-text-primary">
            <span className="text-brand-text-secondary">{t('ticketNotifyCompletedBy')}</span>{' '}
            {actorHref ? (
              <Link
                href={actorHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {actorName}
              </Link>
            ) : (
              actorName
            )}
          </div>
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_accepted') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const leadId =
        (typeof m.leadUserId === 'string' && m.leadUserId.trim()
          ? m.leadUserId.trim()
          : '') ||
        notification.sourceId ||
        notification.actor?.id ||
        '';
      const leadName = notification.actor?.name || tCommon('someone');
      const leadHref = leadId ? routes.userProfile(leadId) : undefined;

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyAcceptedStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-sm text-brand-text-primary">
            <span className="text-brand-text-secondary">{t('ticketNotifyAcceptedBy')}</span>{' '}
            {leadHref ? (
              <Link
                href={leadHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {leadName}
              </Link>
            ) : (
              leadName
            )}
          </div>
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_returned_for_revision') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const reason = typeof m.reason === 'string' ? m.reason : '';
      const leadId =
        (typeof m.leadUserId === 'string' && m.leadUserId.trim()
          ? m.leadUserId.trim()
          : '') ||
        notification.sourceId ||
        notification.actor?.id ||
        '';
      const leadName = notification.actor?.name || tCommon('someone');
      const leadHref = leadId ? routes.userProfile(leadId) : undefined;

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyRevisionStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-sm text-brand-text-primary">
            <span className="text-brand-text-secondary">{t('ticketNotifyReturnedBy')}</span>{' '}
            {leadHref ? (
              <Link
                href={leadHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {leadName}
              </Link>
            ) : (
              leadName
            )}
          </div>
          {reason ? (
            <div className="whitespace-pre-wrap break-words text-sm text-brand-text-primary">
              <span className="text-brand-text-secondary">{t('ticketNotifyCommentLabel')}</span>:{' '}
              {reason}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_assignee_declined') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const reason = typeof m.reason === 'string' ? m.reason : '';
      const assigneeId =
        (typeof m.assigneeId === 'string' && m.assigneeId.trim()
          ? m.assigneeId.trim()
          : '') || notification.sourceId || notification.actor?.id || '';
      const assigneeName =
        (typeof m.assigneeDisplayName === 'string' && m.assigneeDisplayName.trim()
          ? m.assigneeDisplayName.trim()
          : '') ||
        notification.actor?.name ||
        tCommon('someone');
      const assigneeHref = assigneeId ? routes.userProfile(assigneeId) : undefined;

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyDeclinedStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className="text-sm text-brand-text-primary">
            <span className="text-brand-text-secondary">{t('ticketNotifyDeclinedBy')}</span>{' '}
            {assigneeHref ? (
              <Link
                href={assigneeHref}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-brand-primary hover:underline"
              >
                {assigneeName}
              </Link>
            ) : (
              assigneeName
            )}
          </div>
          {reason ? (
            <div className="whitespace-pre-wrap break-words text-sm text-brand-text-primary">
              <span className="text-brand-text-secondary">{t('ticketNotifyCommentLabel')}</span>:{' '}
              {reason}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'ticket_rejection') {
      const { ticketHref, projectHref, ticketTitle, projectName } = buildTicketLinkParts(
        m,
        t('untitledPost'),
      );
      const custom =
        typeof m.rejectionMessage === 'string' && m.rejectionMessage.trim()
          ? m.rejectionMessage.trim()
          : '';

      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm text-brand-text-primary">{t('ticketNotifyRejectionStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className="font-medium break-words">{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-brand-primary hover:underline break-words"
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className="text-sm break-words">{quotePlaceLabel(projectName, locale)}</span>
          )}
          {custom ? (
            <div className="whitespace-pre-wrap break-words text-sm text-brand-text-primary">
              {custom}
            </div>
          ) : null}
          <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    const primary = formatNotificationMessage(notification);
    const lines = primary.split('\n').filter((line) => line.length > 0);
    const showActor =
      !NOTIFICATION_TYPES_WITHOUT_SEPARATE_ACTOR.has(notification.type) && notification.actor?.name;
    const contextHref = NOTIFICATION_TYPES_HIDE_CONTEXT.has(notification.type)
      ? undefined
      : resolveNotificationContextHref(notification);
    const contextLabel = NOTIFICATION_TYPES_HIDE_CONTEXT.has(notification.type)
      ? undefined
      : contextLabelFromMetadata(notification);
    const contextNode =
      contextLabel && contextHref ? (
        <Link
          href={contextHref}
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-brand-primary hover:underline break-words"
        >
          {quotePlaceLabel(contextLabel, locale)}
        </Link>
      ) : contextLabel ? (
        <span className="whitespace-pre-wrap break-words">{contextLabel}</span>
      ) : null;

    return (
      <div className="flex flex-col gap-1">
        {lines.map((line, i) => (
          <div key={`p-${i}`} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
        {showActor ? <div>{notification.actor!.name}</div> : null}
        {contextNode ? <div>{contextNode}</div> : null}
        <div className="text-base-content/55">{formatDate(notification.createdAt)}</div>
      </div>
    );
  };

  const filterOptions = useMemo(() => [
    { value: 'all', label: t('filters.all') },
    { value: 'unread', label: t('filters.unread') },
    { value: 'mention', label: t('filters.mention') },
    { value: 'reply', label: t('filters.reply') },
    { value: 'vote', label: t('filters.vote') },
    { value: 'invite', label: t('filters.invite') },
    { value: 'forward_proposal', label: t('filters.forward_proposal') },
  ], [t]);

  return (
    <AdaptiveLayout
    >
      <div className="space-y-4">
        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Filter size={18} className="text-brand-text-secondary" />
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as typeof filter)}
            >
              <SelectTrigger className={cn('flex-1 sm:max-w-xs h-11 rounded-xl')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsRead.isPending}
                className="rounded-xl active:scale-[0.98] w-fit"
              >
                <CheckCheck size={16} className="mr-1" />
                {t('markAllRead')}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreferences(!showPreferences)}
              className="rounded-xl active:scale-[0.98] w-fit"
            >
              <Settings size={16} />
            </Button>
          </div>
        </div>

        {/* Notification Preferences (collapsible) */}
        {showPreferences && (
          <NotificationPreferencesPanel />
        )}

        {/* Notifications List */}
        {isLoading ? (
          <div className="space-y-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`relative overflow-hidden rounded-xl ${!notification.read ? 'bg-blue-50/50' : ''}`}
              >
                <InfoCard
                  title={getNotificationTitle(notification)}
                  subtitle={renderNotificationSubtitle(notification)}
                  icon={
                    <div className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </div>
                  }
                  rightElement={
                    <div className="flex items-center gap-1">
                      {notification.actor?.avatarUrl && (
                        <Avatar className="w-8 h-8 text-xs mr-2">
                          {notification.actor.avatarUrl && (
                            <AvatarImage src={notification.actor.avatarUrl} alt={notification.actor.name} />
                          )}
                          <AvatarFallback userId={notification.actor.id} className="font-medium uppercase">
                            {notification.actor.name ? notification.actor.name.slice(0, 2).toUpperCase() : <User size={14} />}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {/* Action buttons for team invitations */}
                      {notification.type === 'team_invitation' && !notification.read && notification.metadata?.invitationId && (
                        <div className="flex items-center gap-2 mr-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              const invitationId = notification.metadata?.invitationId;
                              if (invitationId) {
                                acceptInvitation.mutate(
                                  { invitationId },
                                  {
                                    onSuccess: (data) => {
                                      const cid = data.communityId;
                                      if (cid) {
                                        router.push(
                                          data.inviteTargetIsProject
                                            ? `/meriter/projects/${cid}`
                                            : `/meriter/communities/${cid}`,
                                        );
                                      }
                                    },
                                  },
                                );
                                markAsRead.mutate({ id: notification.id });
                              }
                            }}
                            disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                            className="h-7 px-3 text-xs rounded-lg"
                          >
                            {acceptInvitation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t('accept')
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              const invitationId = notification.metadata?.invitationId;
                              if (invitationId) {
                                rejectInvitation.mutate({ invitationId });
                                markAsRead.mutate({ id: notification.id });
                              }
                            }}
                            disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                            className="h-7 px-3 text-xs rounded-lg"
                          >
                            {rejectInvitation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t('decline')
                            )}
                          </Button>
                        </div>
                      )}
                      {isTeamJoinRequestActionable(notification) && (
                        <div
                          className="flex flex-wrap items-center justify-end gap-2 mr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              const requestId = notification.metadata?.requestId;
                              if (typeof requestId === 'string') {
                                approveTeamJoinRequest.mutate({ requestId });
                                markAsRead.mutate({ id: notification.id });
                              }
                            }}
                            disabled={
                              approveTeamJoinRequest.isPending || rejectTeamJoinRequest.isPending
                            }
                            className="h-7 px-3 text-xs rounded-lg"
                          >
                            {approveTeamJoinRequest.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t('accept')
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              const requestId = notification.metadata?.requestId;
                              if (typeof requestId === 'string') {
                                rejectTeamJoinRequest.mutate({ requestId });
                                markAsRead.mutate({ id: notification.id });
                              }
                            }}
                            disabled={
                              approveTeamJoinRequest.isPending || rejectTeamJoinRequest.isPending
                            }
                            className="h-7 px-3 text-xs rounded-lg"
                          >
                            {rejectTeamJoinRequest.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t('decline')
                            )}
                          </Button>
                        </div>
                      )}
                      {notification.type === 'ob_vote_join_offer' && !notification.read && (
                        <div
                          className="flex flex-wrap items-center justify-end gap-2 mr-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {typeof notification.metadata?.communityId === 'string' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-3 text-xs rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cid = notification.metadata?.communityId;
                                if (typeof cid === 'string') {
                                  router.push(`/meriter/communities/${cid}/join`);
                                  markAsRead.mutate({ id: notification.id });
                                }
                              }}
                            >
                              {t('obVoteJoinCta')}
                            </Button>
                          )}
                          {notification.url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(notification.url as string);
                                markAsRead.mutate({ id: notification.id });
                              }}
                            >
                              {t('obVoteOpenPost')}
                            </Button>
                          )}
                        </div>
                      )}
                      {!notification.read &&
                        notification.type !== 'team_invitation' &&
                        !isTeamJoinRequestActionable(notification) &&
                        notification.type !== 'ob_vote_join_offer' && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead.mutate({ id: notification.id });
                          }}
                          className="p-1 hover:bg-base-200 rounded-full transition-colors cursor-pointer"
                          role="button"
                          tabIndex={0}
                          aria-label={t('ariaLabels.markAsRead')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              markAsRead.mutate({ id: notification.id });
                            }
                          }}
                        >
                          <Check size={16} className="text-base-content/60" />
                        </div>
                      )}
                    </div>
                  }
                  onClick={() => handleNotificationClick(notification)}
                  className={!notification.read ? 'border-blue-200' : ''}
                />
              </div>
            ))}

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="h-4" />

            {/* Loading indicator */}
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-base-content/60">
            <Bell className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
            <p className="font-medium">{t('noNotifications')}</p>
            <p className="text-sm mt-1">
              {filter === 'unread'
                ? t('noUnreadNotifications')
                : t('noNotificationsDescription')}
            </p>
          </div>
        )}
      </div>
    </AdaptiveLayout>
  );
}

// Notification Preferences Panel Component
function NotificationPreferencesPanel() {
  const t = useTranslations('notifications');
  const { data: preferences, isLoading } = useNotificationPreferences();
  const { mutate: updatePreferences } = useUpdatePrefs();
  const [localPreferences, setLocalPreferences] = useState(preferences || {
    mentions: true,
    replies: true,
    votes: true,
    invites: true,
    comments: true,
    publications: true,
    polls: true,
    system: true,
    forward_proposal: true,
  });

  React.useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  const handleToggle = (key: keyof typeof localPreferences) => {
    const updated = { ...localPreferences, [key]: !localPreferences[key] };
    setLocalPreferences(updated);
    updatePreferences({ [key]: updated[key] });
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-base-200 rounded-xl shadow-none">
        <Loader2 className="w-5 h-5 animate-spin text-brand-primary mx-auto" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-base-200 rounded-xl shadow-none space-y-3">
      <h3 className="font-semibold text-brand-text-primary">
        {t('preferences.title')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(localPreferences).map(([key, value]) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer p-2 hover:bg-base-200 rounded-lg transition-colors"
          >
            <input
              type="checkbox"
              checked={value}
              onChange={() => handleToggle(key as keyof typeof localPreferences)}
              className="w-4 h-4 text-brand-primary rounded"
            />
            <span className="text-sm text-brand-text-primary">
              {t(`preferences.${key}`) || key}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
