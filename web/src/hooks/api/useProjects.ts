'use client';

import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { STALE_TIME } from '@/lib/constants/query-config';

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

export function useProject(projectId: string | null) {
  return trpc.project.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId, staleTime: STALE_TIME.SHORT },
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
      utils.users.getMe.invalidate();
      addToast(t('created'), 'success');
      router.push(`/meriter/projects/${project.id}`);
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
    },
  });
}

export function useJoinProject() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.join.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      utils.project.getById.invalidate();
      addToast(t('joinRequestSent'), 'success');
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
    onSuccess: () => {
      utils.project.list.invalidate();
      utils.project.getById.invalidate();
      utils.users.getMe.invalidate();
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
    onSuccess: () => {
      utils.project.getById.invalidate();
      addToast(t('topUpSuccess'), 'success');
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

export function usePublishToBirzha() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const t = useTranslations('projects');

  return trpc.project.publishToBirzha.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate();
      utils.project.getWallet.invalidate();
      utils.publications.getFeed.invalidate();
      utils.publications.getAll.invalidate();
      addToast(t('publishedToBirzhaSuccess'), 'success');
    },
    onError: (error) => {
      addToast(resolveApiErrorToastMessage(error.message), 'error');
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

export function useOpenTickets(projectId: string | null) {
  return trpc.project.getOpenTickets.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId, staleTime: STALE_TIME.SHORT },
  );
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
