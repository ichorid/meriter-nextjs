import type { Notification, NotificationType } from '@/types/api-v1';
import { routes } from '@/lib/constants/routes';

/** Notification list card subtitle typography — see `.cursor/rules/frontend-notifications.mdc`. */
export const NOTIFY_SUB = {
  stack: 'flex flex-col gap-1.5',
  body: 'text-brand-text-primary whitespace-pre-wrap break-words',
  bodyMuted: 'text-brand-text-secondary whitespace-pre-wrap break-words',
  entityLink: 'font-medium text-brand-primary hover:underline break-words',
  entityText: 'font-medium text-brand-text-primary break-words',
  stamp: 'text-xs text-base-content/55',
} as const;

const SYSTEM_NOTICE_TITLE_TO_KIND: Record<string, string> = {
  'Team join request approved': 'team_join_approved',
  'Team join request rejected': 'team_join_rejected',
  'Team invitation accepted': 'team_invitation_accepted',
  'Team invitation rejected': 'team_invitation_rejected',
};

export function contextLabelFromMetadata(n: Notification): string | undefined {
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

export const NOTIFICATION_TYPES_WITHOUT_SEPARATE_ACTOR = new Set<NotificationType>([
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

export const NOTIFICATION_TYPES_HIDE_CONTEXT = new Set<NotificationType>([
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

export function communityOrProjectHref(communityId: string, isProject: boolean): string {
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

export function resolveNotificationContextHref(n: Notification): string | undefined {
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

export function buildTicketLinkParts(
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

export function isTeamJoinRequestActionable(notification: Notification): boolean {
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

export function quotePlaceLabel(placeName: string, locale: string): string {
  return locale.startsWith('ru') ? `«${placeName}»` : `"${placeName}"`;
}

export function resolveInviteTargetIsProject(n: Notification): boolean {
  return n.metadata?.inviteTargetIsProject === true;
}

export function resolveSystemNoticeKind(n: Notification): string | undefined {
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
