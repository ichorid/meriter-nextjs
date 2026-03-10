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

export function useAcceptWork() {
  const utils = trpc.useUtils();

  return trpc.ticket.accept.useMutation({
    onSuccess: () => {
      utils.ticket.getByProject.invalidate();
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
