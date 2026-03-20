'use client';

import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { STALE_TIME } from '@/lib/constants/query-config';
import type { TicketStatus } from '@meriter/shared-types';

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
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
      utils.project.getById.invalidate();
      addToast(t('ticketCreated'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('ticketCreateError'), 'error');
    },
  });
}

export function useUpdateTicketStatus() {
  const utils = trpc.useUtils();

  return trpc.ticket.updateStatus.useMutation({
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
    },
  });
}

export function useUpdateTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.update.useMutation({
    onSuccess: (_data, variables) => {
      utils.ticket.getByProject.invalidate();
      void utils.publications.getById.invalidate({ id: variables.ticketId });
      addToast(t('ticketUpdated'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('ticketUpdateError'), 'error');
    },
  });
}

export function useAcceptWork() {
  const utils = trpc.useUtils();

  return trpc.ticket.accept.useMutation({
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
    },
  });
}

export function useDeclineAsAssignee() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.declineAsAssignee.useMutation({
    onSuccess: (_data, variables) => {
      void utils.ticket.getByProject.invalidate();
      void utils.publications.getById.invalidate({ id: variables.ticketId });
      void utils.project.getOpenTickets.invalidate();
      void utils.comments.getByPublicationId.invalidate({
        publicationId: variables.ticketId,
      });
      addToast(t('declineAssigneeSuccess'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('declineAssigneeError'), 'error');
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
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
      utils.project.getById.invalidate();
      utils.project.getOpenTickets.invalidate();
      addToast(t('ticketCreated'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('ticketCreateError'), 'error');
    },
  });
}

export function useApplyForTicket() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.applyForTicket.useMutation({
    onSuccess: (_data, variables) => {
      void utils.project.getOpenTickets.invalidate();
      void utils.ticket.getByProject.invalidate();
      void utils.publications.getById.invalidate({ id: variables.ticketId });
      addToast(t('applySuccess', { defaultValue: 'Application sent' }), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('applyError', { defaultValue: 'Failed to apply' }), 'error');
    },
  });
}

export function useTakeOpenNeutralAsModerator() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.takeOpenNeutralAsModerator.useMutation({
    onSuccess: (_data, variables) => {
      void utils.project.getOpenTickets.invalidate();
      void utils.ticket.getByProject.invalidate();
      void utils.publications.getById.invalidate({ id: variables.ticketId });
      void utils.ticket.getApplicants.invalidate({ ticketId: variables.ticketId });
      addToast(t('takeOpenNeutralModeratorSuccess'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('takeOpenNeutralModeratorError'), 'error');
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
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
      utils.project.getOpenTickets.invalidate();
      utils.ticket.getApplicants.invalidate();
      addToast(t('approveApplicantSuccess', { defaultValue: 'Applicant approved' }), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('approveApplicantError', { defaultValue: 'Failed to approve' }), 'error');
    },
  });
}

export function useRejectApplicant() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.ticket.reject.useMutation({
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
      utils.project.getOpenTickets.invalidate();
      utils.ticket.getApplicants.invalidate();
      addToast(t('rejectApplicantSuccess', { defaultValue: 'Applicant rejected' }), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('rejectApplicantError', { defaultValue: 'Failed to reject' }), 'error');
    },
  });
}
