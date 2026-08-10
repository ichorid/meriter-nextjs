import type { Notification } from '@/types/api-v1';
import { routes } from '@/lib/constants/routes';
import { getNotificationRoutingRow } from './get-notification-routing-row';
import type { NotificationLinkPattern } from './routing-matrix';

/**
 * Resolves deep-link URL from inv-25 linkPattern + metadata (mirrors NotificationService.buildRedirectUrl).
 */
export function resolveNotificationLink(notification: Notification): string | undefined {
  const { linkPattern } = getNotificationRoutingRow(notification.type);
  const meta = notification.metadata ?? {};
  const pattern = linkPattern as NotificationLinkPattern;

  switch (pattern) {
    case 'community.post': {
      const communityId =
        (typeof meta.communityId === 'string' && meta.communityId.trim()) ||
        (typeof meta.publicationCommunityId === 'string' && meta.publicationCommunityId.trim()) ||
        (typeof meta.futureVisionCommunityId === 'string' && meta.futureVisionCommunityId.trim()) ||
        undefined;
      const publicationId =
        (typeof meta.publicationId === 'string' && meta.publicationId.trim()) ||
        (typeof meta.postId === 'string' && meta.postId.trim()) ||
        undefined;
      if (communityId && publicationId) {
        return routes.communityPost(communityId, publicationId);
      }
      if (communityId && notification.type === 'vote') {
        return routes.communityMembers(communityId);
      }
      return undefined;
    }

    case 'community.members': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      return communityId ? routes.communityMembers(communityId) : undefined;
    }

    case 'community.post.highlight': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      const publicationId =
        typeof meta.publicationId === 'string' && meta.publicationId.trim()
          ? meta.publicationId.trim()
          : undefined;
      if (!communityId || !publicationId) {
        return undefined;
      }
      const targetId =
        (typeof meta.targetId === 'string' && meta.targetId.trim()) ||
        (typeof meta.commentId === 'string' && meta.commentId.trim()) ||
        undefined;
      const base = routes.communityPost(communityId, publicationId);
      return targetId ? `${base}?highlight=${encodeURIComponent(targetId)}` : base;
    }

    case 'community.poll': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      const pollId =
        typeof meta.pollId === 'string' && meta.pollId.trim() ? meta.pollId.trim() : undefined;
      if (!communityId || !pollId) {
        return undefined;
      }
      return `/meriter/communities/${communityId}?poll=${pollId}`;
    }

    case 'community.postOrPoll': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      if (!communityId) {
        return undefined;
      }
      if (meta.targetType === 'poll' || meta.pollId) {
        const pollId = typeof meta.pollId === 'string' ? meta.pollId : undefined;
        return pollId ? `/meriter/communities/${communityId}?poll=${pollId}` : undefined;
      }
      const publicationId =
        typeof meta.publicationId === 'string' && meta.publicationId.trim()
          ? meta.publicationId.trim()
          : undefined;
      return publicationId ? routes.communityPost(communityId, publicationId) : undefined;
    }

    case 'project.orCommunity.inviteTarget': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      if (!communityId) {
        return undefined;
      }
      return meta.inviteTargetIsProject === true
        ? routes.project(communityId)
        : routes.community(communityId);
    }

    case 'community': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      return communityId ? routes.community(communityId) : undefined;
    }

    case 'project.orCommunity.members': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      if (!communityId) {
        return undefined;
      }
      return meta.inviteTargetIsProject === true
        ? routes.project(communityId)
        : routes.communityMembers(communityId);
    }

    case 'community.projects': {
      const parentCommunityId =
        typeof meta.parentCommunityId === 'string' && meta.parentCommunityId.trim()
          ? meta.parentCommunityId.trim()
          : undefined;
      return parentCommunityId
        ? `/meriter/communities/${parentCommunityId}/projects`
        : undefined;
    }

    case 'project': {
      const projectId =
        typeof meta.projectId === 'string' && meta.projectId.trim()
          ? meta.projectId.trim()
          : undefined;
      return projectId ? routes.project(projectId) : undefined;
    }

    case 'project.ticket': {
      const projectId =
        typeof meta.projectId === 'string' && meta.projectId.trim()
          ? meta.projectId.trim()
          : undefined;
      const ticketId =
        typeof meta.ticketId === 'string' && meta.ticketId.trim()
          ? meta.ticketId.trim()
          : undefined;
      if (!projectId || !ticketId) {
        return undefined;
      }
      return `${routes.project(projectId)}?highlight=${encodeURIComponent(ticketId)}`;
    }

    case 'birzha.post': {
      const birzhaCommunityId =
        typeof meta.birzhaCommunityId === 'string' && meta.birzhaCommunityId.trim()
          ? meta.birzhaCommunityId.trim()
          : undefined;
      const publicationId =
        typeof meta.publicationId === 'string' && meta.publicationId.trim()
          ? meta.publicationId.trim()
          : undefined;
      if (birzhaCommunityId && publicationId) {
        return routes.communityPost(birzhaCommunityId, publicationId);
      }
      return undefined;
    }

    case 'community.postOrProject': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      const publicationId =
        typeof meta.publicationId === 'string' && meta.publicationId.trim()
          ? meta.publicationId.trim()
          : undefined;
      const isProject = meta.inviteTargetIsProject === true;
      if (communityId && publicationId) {
        return isProject
          ? `/meriter/projects/${communityId}?post=${publicationId}`
          : routes.communityPost(communityId, publicationId);
      }
      if (communityId) {
        return isProject ? routes.project(communityId) : routes.community(communityId);
      }
      return undefined;
    }

    case 'community.document.block': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      const documentId =
        typeof meta.documentId === 'string' && meta.documentId.trim()
          ? meta.documentId.trim()
          : undefined;
      const blockId =
        typeof meta.blockId === 'string' && meta.blockId.trim() ? meta.blockId.trim() : undefined;
      if (!communityId || !documentId) {
        return undefined;
      }
      return blockId
        ? routes.communityDocumentBlock(communityId, documentId, blockId)
        : routes.communityDocument(communityId, documentId);
    }

    case 'community.document': {
      const communityId =
        typeof meta.communityId === 'string' && meta.communityId.trim()
          ? meta.communityId.trim()
          : undefined;
      const documentId =
        typeof meta.documentId === 'string' && meta.documentId.trim()
          ? meta.documentId.trim()
          : undefined;
      if (!communityId || !documentId) {
        return undefined;
      }
      return routes.communityDocument(communityId, documentId);
    }

    default: {
      const _exhaustive: never = pattern;
      return _exhaustive;
    }
  }
}
