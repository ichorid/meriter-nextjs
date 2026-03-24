'use client';

import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { trpc } from '@/lib/trpc/client';
import {
  refetchCommunityFeed,
  type CommunitySessionCacheUtils,
} from '@/hooks/api/invalidate-community-session-caches';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { TicketStatus } from '@meriter/shared-types';

type UtilsWithPublicationCache = CommunitySessionCacheUtils & {
  publications: { getById: { getData: (input: { id: string }) => unknown } };
};

async function refetchCommunityFeedForPublication(
  utils: UtilsWithPublicationCache,
  publicationId: string,
): Promise<void> {
  const data = utils.publications.getById.getData({ id: publicationId });
  const communityId = (data as { communityId?: string } | undefined)?.communityId;
  if (communityId) {
    await refetchCommunityFeed(utils, communityId);
  }
}

export function useTickets(
  projectId: string | null,
  options: { postType?: 'ticket' | 'discussion'; ticketStatus?: TicketStatus } = {},
) {
  return trpc.ticket.getByProject.useQuery(
    {
      projectId: projectId!,
      postType: options.postType,
      ticketStatus: options.ticketStatus,
    },
    {
      enabled: !!projectId,
      staleTime: STALE_TIME.VERY_SHORT,
    },
  );
}

export function useCreateTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.create.useMutation({
    onSuccess: async (_result, variables) => {
      utils.ticket.getByProject.invalidate();
      utils.project.getById.invalidate();
      await refetchCommunityFeed(utils, variables.projectId);
      addToast(t('ticketCreated'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useUpdateTicketStatus() {
  const utils = trpc.useUtils();

  return trpc.ticket.updateStatus.useMutation({
    onSuccess: async (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
    },
  });
}

export function useUpdateTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.update.useMutation({
    onSuccess: async (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      await utils.publications.getById.invalidate({ id: variables.ticketId });
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('ticketUpdated'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useAcceptWork() {
  const utils = trpc.useUtils();

  return trpc.ticket.accept.useMutation({
    onSuccess: async (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
    },
  });
}

export function useDeclineAsAssignee() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.declineAsAssignee.useMutation({
    onSuccess: async (_data, variables) => {
      void utils.ticket.getByProject.invalidate();
      await utils.publications.getById.invalidate({ id: variables.ticketId });
      void utils.project.getOpenTickets.invalidate();
      void utils.comments.getByPublicationId.invalidate({
        publicationId: variables.ticketId,
      });
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('declineAssigneeSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useProjectShares(projectId: string | null) {
  return trpc.project.getShares.useQuery(
    { projectId: projectId! },
    {
      enabled: !!projectId,
      staleTime: STALE_TIME.SHORT,
    },
  );
}

export function useCreateNeutralTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.createNeutral.useMutation({
    onSuccess: async (_result, variables) => {
      utils.ticket.getByProject.invalidate();
      utils.project.getById.invalidate();
      utils.project.getOpenTickets.invalidate();
      await refetchCommunityFeed(utils, variables.projectId);
      addToast(t('ticketCreated'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useApplyForTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.applyForTicket.useMutation({
    onSuccess: async (_data, variables) => {
      void utils.project.getOpenTickets.invalidate();
      void utils.ticket.getByProject.invalidate();
      await utils.publications.getById.invalidate({ id: variables.ticketId });
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('applySuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useTakeOpenNeutralAsModerator() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.takeOpenNeutralAsModerator.useMutation({
    onSuccess: async (_data, variables) => {
      void utils.project.getOpenTickets.invalidate();
      void utils.ticket.getByProject.invalidate();
      await utils.publications.getById.invalidate({ id: variables.ticketId });
      void utils.ticket.getApplicants.invalidate({ ticketId: variables.ticketId });
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('takeOpenNeutralModeratorSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useGetApplicants(ticketId: string | null) {
  return trpc.ticket.getApplicants.useQuery(
    { ticketId: ticketId! },
    { enabled: !!ticketId, staleTime: STALE_TIME.VERY_SHORT },
  );
}

export function useApproveApplicant() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.approve.useMutation({
    onSuccess: async (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      utils.project.getOpenTickets.invalidate();
      utils.ticket.getApplicants.invalidate();
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('approveApplicantSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useRejectApplicant() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.reject.useMutation({
    onSuccess: async (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      utils.project.getOpenTickets.invalidate();
      utils.ticket.getApplicants.invalidate();
      await refetchCommunityFeedForPublication(utils, variables.ticketId);
      addToast(t('rejectApplicantSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}
