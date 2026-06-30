'use client';

import React from 'react';
import Link from 'next/link';
import type { Notification } from '@/types/api-v1';
import { routes } from '@/lib/constants/routes';
import { formatMerits } from '@/lib/utils/currency';
import {
  NOTIFY_SUB,
  NOTIFICATION_TYPES_HIDE_CONTEXT,
  NOTIFICATION_TYPES_WITHOUT_SEPARATE_ACTOR,
  buildTicketLinkParts,
  communityOrProjectHref,
  contextLabelFromMetadata,
  quotePlaceLabel,
  resolveInviteTargetIsProject,
  resolveNotificationContextHref,
  resolveSystemNoticeKind,
} from '@/app/meriter/notifications/notificationClientConstants';
import {
  formatNotificationMessage,
  type NotificationIntl,
} from '@/app/meriter/notifications/notificationClientFormat';
import { getNotificationRoutingRow } from './get-notification-routing-row';

export type NotificationSubtitleContext = {
  t: NotificationIntl;
  tCommon: NotificationIntl;
  locale: string;
  formatDate: (dateString: string) => string;
};

function renderMessageSubtitle(
  notification: Notification,
  ctx: NotificationSubtitleContext,
): React.ReactNode {
  const { t, tCommon, locale, formatDate } = ctx;
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
}

export function renderNotificationSubtitle(
  notification: Notification,
  ctx: NotificationSubtitleContext,
): React.ReactNode {
  const { subtitleKey } = getNotificationRoutingRow(notification.type);
  const { t, tCommon, locale, formatDate } = ctx;
  const m = notification.metadata ?? {};
  const isProject = resolveInviteTargetIsProject(notification);

  switch (subtitleKey) {
    case 'structured.system': {
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
      return renderMessageSubtitle(notification, ctx);
    }

    case 'structured.teamInvitation': {
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

    case 'structured.communityMemberRemoved': {
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

    case 'structured.teamJoinRequest': {
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

    case 'structured.projectParentLinkRequested': {
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

    case 'structured.projectDistributed': {
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

    case 'structured.ticketAssigned': {
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

    case 'structured.ticketApply': {
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

    case 'structured.documentVariant': {
      const communityId = typeof m.communityId === 'string' ? m.communityId : '';
      const documentId = typeof m.documentId === 'string' ? m.documentId : '';
      const blockId = typeof m.blockId === 'string' ? m.blockId : '';
      const documentTitle =
        typeof m.documentTitle === 'string' && m.documentTitle.trim()
          ? m.documentTitle.trim()
          : t('untitledPost');
      const documentHref =
        communityId && documentId
          ? blockId
            ? routes.communityDocumentBlock(communityId, documentId, blockId)
            : routes.communityDocument(communityId, documentId)
          : '';
      const body =
        notification.type === 'document_variant_proposed'
          ? t('documentVariantProposedBody', {
              name: notification.actor?.name || tCommon('someone'),
            })
          : notification.type === 'document_variant_not_selected'
            ? t('documentVariantNotSelectedBody')
            : notification.type === 'document_variant_won'
              ? t('documentVariantWonBody')
              : notification.type === 'document_variant_applied'
                ? t('documentVariantAppliedBody')
                : t('documentBlockAdminOverrideBody');

      return (
        <div className={NOTIFY_SUB.stack}>
          <div className={NOTIFY_SUB.body}>{body}</div>
          {documentHref ? (
            <Link
              href={documentHref}
              onClick={(e) => e.stopPropagation()}
              className={NOTIFY_SUB.entityLink}
            >
              {quotePlaceLabel(documentTitle, locale)}
            </Link>
          ) : (
            <span className={NOTIFY_SUB.entityText}>{quotePlaceLabel(documentTitle, locale)}</span>
          )}
          <div className={NOTIFY_SUB.stamp}>{formatDate(notification.createdAt)}</div>
        </div>
      );
    }

    case 'structured.ticketDone': {
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

    case 'structured.ticketAccepted': {
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

    case 'structured.ticketReturnedForRevision': {
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

    case 'structured.ticketAssigneeDeclined': {
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

    case 'structured.ticketRejection': {
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

    case 'structured.investmentReceived': {
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

    case 'structured.vote': {
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

    default:
      return renderMessageSubtitle(notification, ctx);
  }
}
