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
import { formatMerits } from '@/lib/utils/currency';
import {
  NOTIFY_SUB,
  NOTIFICATION_TYPES_HIDE_CONTEXT,
  NOTIFICATION_TYPES_WITHOUT_SEPARATE_ACTOR,
  buildTicketLinkParts,
  communityOrProjectHref,
  contextLabelFromMetadata,
  isTeamJoinRequestActionable,
  quotePlaceLabel,
  resolveInviteTargetIsProject,
  resolveNotificationContextHref,
  resolveSystemNoticeKind,
} from './notificationClientConstants';
import {
  formatNotificationMessage,
  getNotificationIcon,
  getNotificationTitle,
} from './notificationClientFormat';

export default function NotificationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
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
        <div className={NOTIFY_SUB.stack}>
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={(e) => e.stopPropagation()}
                className={NOTIFY_SUB.entityLink}
              >
                {actorName}
              </Link>
            ) : (
              <span className={NOTIFY_SUB.entityText}>{actorName}</span>
            )}
            <div className={NOTIFY_SUB.body}>{line1Suffix.trimStart()}</div>
            {placeName ? (
              <div>
                {placeHref ? (
                  <Link
                    href={placeHref}
                    onClick={(e) => e.stopPropagation()}
                    className={NOTIFY_SUB.entityLink}
                  >
                    {quotePlaceLabel(placeName, locale)}
                  </Link>
                ) : (
                  <span className={NOTIFY_SUB.body}>{quotePlaceLabel(placeName, locale)}</span>
                )}
              </div>
            ) : null}
            <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.body}>{t('teamInvitationInvitedYouSuffix').trimStart()}</div>
          {placeName ? (
            <div>
              {placeHref ? (
                <Link
                  href={placeHref}
                  onClick={(e) => e.stopPropagation()}
                  className={NOTIFY_SUB.entityLink}
                >
                  {quotePlaceLabel(placeName, locale)}
                </Link>
              ) : (
                <span className={NOTIFY_SUB.body}>{quotePlaceLabel(placeName, locale)}</span>
              )}
            </div>
          ) : null}
          {note ? (
            <div className={NOTIFY_SUB.body}>
              <span className={NOTIFY_SUB.bodyMuted}>{t('teamInvitationCommentLabel')}</span>{' '}
              {note}
            </div>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.body}>{t('communityMemberRemovedActorSuffix').trimStart()}</div>
          {placeName ? (
            <div>
              {placeHref ? (
                <Link
                  href={placeHref}
                  onClick={(e) => e.stopPropagation()}
                  className={NOTIFY_SUB.entityLink}
                >
                  {quotePlaceLabel(placeName, locale)}
                </Link>
              ) : (
                <span className={NOTIFY_SUB.body}>{quotePlaceLabel(placeName, locale)}</span>
              )}
            </div>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.body}>{t('teamJoinRequestWantsToJoinSuffix').trimStart()}</div>
          {teamName ? (
            <div>
              {placeHref ? (
                <Link
                  href={placeHref}
                  onClick={(e) => e.stopPropagation()}
                  className={NOTIFY_SUB.entityLink}
                >
                  {quotePlaceLabel(teamName, locale)}
                </Link>
              ) : (
                <span className={NOTIFY_SUB.body}>{quotePlaceLabel(teamName, locale)}</span>
              )}
            </div>
          ) : null}
          {applicantNote ? (
            <div className={NOTIFY_SUB.body}>
              <span className={NOTIFY_SUB.bodyMuted}>{t('teamJoinRequestApplicantMessageLabel')}</span>{' '}
              {applicantNote}
            </div>
          ) : null}
          {isResolved ? (
            <div className="mt-1 flex flex-col gap-1.5 border-t border-base-200/80 pt-2">
              <div className={NOTIFY_SUB.entityText}>{t('teamJoinRequestResolvedHeading')}</div>
              <div className={NOTIFY_SUB.body}>
                <span className={NOTIFY_SUB.bodyMuted}>{t('teamJoinRequestResolvedByLabel')}</span>
              </div>
              {resolverHref ? (
                <Link
                  href={resolverHref}
                  onClick={(e) => e.stopPropagation()}
                  className={NOTIFY_SUB.entityLink}
                >
                  {resolverName}
                </Link>
              ) : (
                <span className={NOTIFY_SUB.entityText}>{resolverName}</span>
              )}
              {decisionValue ? (
                <div className={NOTIFY_SUB.body}>
                  <span className={NOTIFY_SUB.bodyMuted}>{t('teamJoinRequestDecisionLabel')}</span>{' '}
                  {decisionValue}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.bodyMuted}>{t('projectParentLinkRequestedProjectLabel')}</div>
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('projectParentLinkRequestedMiddle')}</div>
          {parentHref ? (
            <Link
              href={parentHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(parentName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(parentName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('projectParentLinkRequestedByLabel')}</div>
          {requesterHref ? (
            <Link
              href={requesterHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {requesterDisplayName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{requesterDisplayName}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          {finiteYour && yourAmount > 0 ? (
            <div className={NOTIFY_SUB.body}>{t('projectDistributedSubtitleYouReceived', { yourAmount })}</div>
          ) : finiteYour && yourAmount === 0 ? (
            <div className={NOTIFY_SUB.bodyMuted}>{t('projectDistributedSubtitleMemberNoCredits')}</div>
          ) : null}
          {finiteTotal && totalPayout > 0 ? (
            <div className={NOTIFY_SUB.body}>{t('projectDistributedSubtitleTotal', { totalPayout })}</div>
          ) : null}
          {payoutBucket ? (
            <div className={NOTIFY_SUB.bodyMuted}>
              {t('projectDistributedSubtitleRole', {
                role: (() => {
                  const b = payoutBucket.trim().toLowerCase();
                  if (b === 'founder') return t('projectDistributedPayoutRoleFounder');
                  if (b === 'investor') return t('projectDistributedPayoutRoleInvestor');
                  if (b === 'team') return t('projectDistributedPayoutRoleTeam');
                  return payoutBucket.trim();
                })(),
              })}
            </div>
          ) : null}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.stack}>
            {ticketHref ? (
              <Link
                href={ticketHref}
                onClick={(e) => e.stopPropagation()}
                className={NOTIFY_SUB.entityLink}
              >
                {quotePlaceLabel(ticketTitle, locale)}
              </Link>
            ) : (
              <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
            )}
            {projectHref ? (
              <Link
                href={projectHref}
                onClick={(e) => e.stopPropagation()}
                className={NOTIFY_SUB.entityLink}
              >
                {quotePlaceLabel(projectName, locale)}
              </Link>
            ) : (
              <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
            )}
          </div>
          {hasAssigner ? (
            <>
              <div className={NOTIFY_SUB.bodyMuted}>{t('ticketAssignedByLabel')}</div>
              {assignerHref ? (
                <Link
                  href={assignerHref}
                  onClick={(e) => e.stopPropagation()}
                  className={NOTIFY_SUB.entityLink}
                >
                  {assignerName}
                </Link>
              ) : (
                <span className={NOTIFY_SUB.entityText}>{assignerName}</span>
              )}
            </>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyApplyStatus')}</div>
          {actorHref ? (
            <Link
              href={actorHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyApplyWording')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyDoneStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyCompletedBy')}</div>
          {actorHref ? (
            <Link
              href={actorHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyAcceptedStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyAcceptedBy')}</div>
          {leadHref ? (
            <Link
              href={leadHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {leadName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{leadName}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyRevisionStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyReturnedBy')}</div>
          {leadHref ? (
            <Link
              href={leadHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {leadName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{leadName}</span>
          )}
          {reason ? (
            <div className={NOTIFY_SUB.body}>
              <span className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyCommentLabel')}</span>: {reason}
            </div>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyDeclinedStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          <div className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyDeclinedBy')}</div>
          {assigneeHref ? (
            <Link
              href={assigneeHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {assigneeName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{assigneeName}</span>
          )}
          {reason ? (
            <div className={NOTIFY_SUB.body}>
              <span className={NOTIFY_SUB.bodyMuted}>{t('ticketNotifyCommentLabel')}</span>: {reason}
            </div>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{t('ticketNotifyRejectionStatus')}</div>
          {ticketHref ? (
            <Link
              href={ticketHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(ticketTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(ticketTitle, locale)}</span>
          )}
          {projectHref ? (
            <Link
              href={projectHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(projectName, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(projectName, locale)}</span>
          )}
          {custom ? <div className={NOTIFY_SUB.body}>{custom}</div> : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'investment_received') {
      const amount = Number(m.amount);
      const amountFinite = Number.isFinite(amount) ? amount : 0;
      const investorId =
        (typeof m.investorId === 'string' && m.investorId.trim() ? m.investorId.trim() : '') ||
        notification.sourceId ||
        notification.actor?.id ||
        '';
      const investorName = notification.actor?.name || tCommon('someone');
      const investorHref = investorId ? routes.userProfile(investorId) : undefined;
      const postId = typeof m.postId === 'string' && m.postId.trim() ? m.postId.trim() : '';
      const communityId =
        typeof m.communityId === 'string' && m.communityId.trim() ? m.communityId.trim() : '';
      const postHref =
        postId && communityId ? routes.communityPost(communityId, postId) : postId
          ? routes.publication(postId)
          : '';

      return (
        <div className={NOTIFY_SUB.stack}>
          {investorHref ? (
            <Link
              href={investorHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {investorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{investorName}</span>
          )}
          <div className={NOTIFY_SUB.body}>
            {t('investmentNotifyBody', { amount: formatMerits(amountFinite) })}
          </div>
          {postHref ? (
            <Link
              href={postHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {t('investmentNotifyPostLink')}
            </Link>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    if (notification.type === 'vote') {
      const direction = m.direction === 'down' ? 'down' : 'up';
      const targetIsComment = m.targetType === 'vote';
      const amountNum = typeof m.amount === 'number' ? m.amount : Number(m.amount);
      const hasAmount = Number.isFinite(amountNum) && amountNum !== 0;
      const amountSuffix = hasAmount
        ? ` (${direction === 'up' ? '+' : '-'}${formatMerits(Math.abs(amountNum))})`
        : '';
      const bodyKey =
        direction === 'up'
          ? targetIsComment
            ? 'voteNotifyBodyUpComment'
            : 'voteNotifyBodyUpPost'
          : targetIsComment
            ? 'voteNotifyBodyDownComment'
            : 'voteNotifyBodyDownPost';
      const actorId =
        (typeof notification.sourceId === 'string' && notification.sourceId.trim()
          ? notification.sourceId.trim()
          : '') || notification.actor?.id || '';
      const actorName = notification.actor?.name || tCommon('someone');
      const profileHref = actorId ? routes.userProfile(actorId) : undefined;
      const publicationId =
        typeof m.publicationId === 'string' && m.publicationId.trim() ? m.publicationId.trim() : '';
      const communityId =
        typeof m.communityId === 'string' && m.communityId.trim() ? m.communityId.trim() : '';
      const postHref =
        publicationId && communityId
          ? routes.communityPost(communityId, publicationId)
          : publicationId
            ? routes.publication(publicationId)
            : '';
      const contextHref = resolveNotificationContextHref(notification);
      const contextLabel = contextLabelFromMetadata(notification);

      return (
        <div className={NOTIFY_SUB.stack}>
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorName}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorName}</span>
          )}
          <div className={NOTIFY_SUB.body}>
            {t(bodyKey)}
            {amountSuffix}
          </div>
          {postHref ? (
            <Link
              href={postHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {t('investmentNotifyPostLink')}
            </Link>
          ) : null}
          {contextLabel && contextHref ? (
            <Link
              href={contextHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(contextLabel, locale)}
            </Link>
          ) : contextLabel ? (
            <span className={NOTIFY_SUB.body}>{quotePlaceLabel(contextLabel, locale)}</span>
          ) : null}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    const primary = formatNotificationMessage(notification, t, tCommon);
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
          className={NOTIFY_SUB.entityLink}
        >
          {quotePlaceLabel(contextLabel, locale)}
        </Link>
      ) : contextLabel ? (
        <span className={NOTIFY_SUB.body}>{quotePlaceLabel(contextLabel, locale)}</span>
      ) : null;

    const actorIdFallback = notification.actor?.id;
    const actorNameFallback = notification.actor?.name;

    return (
      <div className={NOTIFY_SUB.stack}>
        {lines.map((line, i) => (
          <div key={`p-${i}`} className={NOTIFY_SUB.body}>
            {line}
          </div>
        ))}
        {showActor && actorNameFallback ? (
          actorIdFallback ? (
            <Link
              href={routes.userProfile(actorIdFallback)}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {actorNameFallback}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{actorNameFallback}</span>
          )
        ) : null}
        {contextNode ? <div>{contextNode}</div> : null}
        <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
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
                  title={getNotificationTitle(notification, t)}
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
