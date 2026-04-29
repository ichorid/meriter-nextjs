'use client';

import { keepPreviousData } from '@tanstack/react-query';
import type { Community } from '@meriter/shared-types';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { STALE_TIME } from '@/lib/constants/query-config';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { getPilotHubCommunityId, isPilotClientMode } from '@/config/pilot';

/** Matches API project.getById payload shape for placeholderData when list already has Community */
export type ProjectGetByIdPlaceholder = {
  project: Community;
  walletBalance: number;
  parentCommunity: Community | null;
  pendingParentLink?: {
    requestId: string;
    targetParentCommunityId: string;
    parentName: string | null;
  } | null;
};

export function useProjects(params: {
  parentCommunityId?: string;
  projectStatus?: 'active' | 'closed' | 'archived';
  memberId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return trpc.project.list.useQuery(
    {
      parentCommunityId: params.parentCommunityId,
      projectStatus: params.projectStatus,
      memberId: params.memberId,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    },
    { staleTime: STALE_TIME.VERY_SHORT },
  );
}

export function usePilotDreamsFeed(params?: { page?: number; pageSize?: number }) {
  return trpc.project.getGlobalList.useQuery(
    {
      pilotDreamFeed: true,
      sort: 'createdAt',
      page: params?.page,
      pageSize: params?.pageSize ?? 20,
    },
    { staleTime: STALE_TIME.SHORT, enabled: isPilotClientMode() },
  );
}

/** Pilot hub projects where the user has a team role (lead or participant). */
export function usePilotUserDreams(userId: string | undefined) {
  const hubId = getPilotHubCommunityId();
  return trpc.project.list.useQuery(
    {
      parentCommunityId: hubId,
      memberId: userId,
      page: 1,
      pageSize: 100,
    },
    {
      staleTime: STALE_TIME.SHORT,
      enabled: Boolean(isPilotClientMode() && userId && hubId),
    },
  );
}

export function usePilotDreamUpvote() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('multiObraz');

  return trpc.pilotDreams.upvote.useMutation({
    onSuccess: (_data, variables) => {
      void utils.project.getGlobalList.invalidate();
      void utils.project.list.invalidate();
      void utils.project.getById.invalidate({ id: variables.dreamId });
      addToast(t('dreamUpvoted'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function usePilotMeritsStats() {
  return trpc.pilotDreams.getStats.useQuery(undefined, {
    staleTime: STALE_TIME.VERY_SHORT,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function usePilotPendingJoinRequests(enabled: boolean) {
  return trpc.pilotDreams.getPendingJoinRequests.useQuery(undefined, {
    enabled,
    staleTime: STALE_TIME.VERY_SHORT,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useGlobalProjectsList(
  params: {
    parentCommunityId?: string;
    projectStatus?: 'active' | 'closed' | 'archived';
    memberId?: string;
    search?: string;
    valueTags?: string[];
    sort?: 'createdAt' | 'score';
    page?: number;
    pageSize?: number;
  },
  queryOptions?: { enabled?: boolean },
) {
  return trpc.project.getGlobalList.useQuery(
    {
      parentCommunityId: params.parentCommunityId,
      projectStatus: params.projectStatus,
      memberId: params.memberId,
      search: params.search,
      valueTags: params.valueTags,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    },
    { staleTime: STALE_TIME.SHORT, enabled: queryOptions?.enabled ?? true },
  );
}

export function useProject(
  projectId: string | null,
  options?: { placeholderProjectPayload?: ProjectGetByIdPlaceholder },
) {
  return trpc.project.getById.useQuery(
    { id: projectId! },
    {
      enabled: !!projectId,
      staleTime: STALE_TIME.SHORT,
      /** List/detail views often already have `project`; avoids modal stuck on loading if batch is slow */
      placeholderData: options?.placeholderProjectPayload,
    },
  );
}

export function useCreateProject() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const router = useRouter();
  const t = useTranslations('projects');

  return trpc.project.create.useMutation({
    onSuccess: (project) => {
      utils.project.list.invalidate();
      utils.project.getGlobalList.invalidate();
      utils.communities.getAll.invalidate();
      if (project.parentCommunityId) {
        utils.communities.getById.invalidate({ id: project.parentCommunityId });
      }
      utils.communities.getById.invalidate({ id: project.id });
      utils.project.listParentLinkRequests.invalidate();
      utils.project.listMyParentLinkRequests.invalidate();
      utils.users.getMe.invalidate();
      addToast(t('created'), 'success');
      router.push(`/meriter/projects/${project.id}`);
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useLeaveProject() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.leave.useMutation({
    onSuccess: (_data, variables) => {
      void utils.project.list.invalidate();
      void utils.project.getById.invalidate({ id: variables.projectId });
      void utils.project.getMembers.invalidate({ projectId: variables.projectId });
      void utils.users.getMe.invalidate();
      void utils.communities.getById.invalidate({ id: variables.projectId });
      addToast(t('left'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useProjectMembers(projectId: string | null, opts?: { page?: number; limit?: number; search?: string }) {
  const rawLimit = opts?.limit;
  const limit =
    rawLimit === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(rawLimit)));

  return trpc.project.getMembers.useQuery(
    {
      projectId: projectId!,
      page: opts?.page,
      limit,
      search: opts?.search,
    },
    { enabled: !!projectId, staleTime: STALE_TIME.SHORT },
  );
}

export function useTopUpWallet() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.topUpWallet.useMutation({
    onSuccess: (data, variables) => {
      void utils.project.getWallet.invalidate({ projectId: variables.projectId });
      void utils.project.getById.invalidate({ id: variables.projectId });
      void utils.project.listInvestments.invalidate({ projectId: variables.projectId });
      void utils.users.myInvestments.invalidate();
      void utils.wallets.getBalance.invalidate({ communityId: GLOBAL_COMMUNITY_ID });
      void utils.wallets.getAll.invalidate();
      if (data.mode === 'investment') {
        addToast(t('topUpSuccessInvestment'), 'success');
      } else {
        addToast(t('topUpSuccess'), 'success');
      }
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useProjectWallet(projectId: string | null) {
  return trpc.project.getWallet.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId, staleTime: STALE_TIME.VERY_SHORT },
  );
}

export function useProjectInvestmentsList(
  projectId: string | null,
  opts?: { enabled?: boolean },
) {
  return trpc.project.listInvestments.useQuery(
    { projectId: projectId! },
    {
      enabled: !!projectId && (opts?.enabled ?? true),
      staleTime: STALE_TIME.SHORT,
    },
  );
}

export function useProjectPayoutPreview(projectId: string | null, amount: number, enabled: boolean) {
  return trpc.project.payoutPreview.useQuery(
    { projectId: projectId!, amount },
    {
      enabled: Boolean(projectId) && enabled && amount >= 1,
      staleTime: 0,
      placeholderData: keepPreviousData,
    },
  );
}

export function useProjectPayoutExecute() {
  const utils = trpc.useUtils();

  return trpc.project.payoutExecute.useMutation({
    onSuccess: (_data, variables) => {
      void utils.project.getWallet.invalidate({ projectId: variables.projectId });
      void utils.project.getById.invalidate({ id: variables.projectId });
      void utils.wallets.getAll.invalidate();
    },
  });
}

export function useCloseProject() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.closeProject.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      utils.project.list.invalidate();
      utils.project.getGlobalList.invalidate();
      addToast(t('closeSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useUpdateShares() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.updateShares.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      addToast(t('sharesUpdated'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useOpenTickets(
  projectId: string | null,
  opts?: { enabled?: boolean },
) {
  const allow = opts?.enabled ?? true;
  return trpc.project.getOpenTickets.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && allow, staleTime: STALE_TIME.SHORT },
  );
}

export function useParentLinkRequests(parentCommunityId: string | null, enabled: boolean) {
  return trpc.project.listParentLinkRequests.useQuery(
    { parentCommunityId: parentCommunityId! },
    { enabled: Boolean(parentCommunityId) && enabled, staleTime: STALE_TIME.VERY_SHORT },
  );
}

export function useMyParentLinkRequests() {
  return trpc.project.listMyParentLinkRequests.useQuery(undefined, {
    staleTime: STALE_TIME.VERY_SHORT,
  });
}

export function useApproveParentLinkRequest() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.approveParentLinkRequest.useMutation({
    onSuccess: () => {
      utils.project.listParentLinkRequests.invalidate();
      utils.project.listMyParentLinkRequests.invalidate();
      utils.project.list.invalidate();
      utils.project.getGlobalList.invalidate();
      utils.project.getById.invalidate();
      utils.communities.getById.invalidate();
      addToast(t('parentLinkApprovedToast'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useRejectParentLinkRequest() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.rejectParentLinkRequest.useMutation({
    onSuccess: () => {
      utils.project.listParentLinkRequests.invalidate();
      utils.project.listMyParentLinkRequests.invalidate();
      utils.project.getById.invalidate();
      addToast(t('parentLinkRejectedToast'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useCancelParentLinkRequest() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.cancelParentLinkRequest.useMutation({
    onSuccess: () => {
      utils.project.listParentLinkRequests.invalidate();
      utils.project.listMyParentLinkRequests.invalidate();
      utils.project.getById.invalidate();
      addToast(t('parentLinkCancelledToast'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useRequestParentChange() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.requestParentChange.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      utils.project.list.invalidate();
      utils.project.getGlobalList.invalidate();
      utils.project.listParentLinkRequests.invalidate();
      utils.project.listMyParentLinkRequests.invalidate();
      utils.communities.getById.invalidate();
      addToast(t('parentChangeSavedToast'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useTransferAdmin() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.transferAdmin.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      utils.project.getMembers.invalidate();
      addToast(t('transferAdminSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}
