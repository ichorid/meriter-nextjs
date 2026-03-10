'use client';

import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { STALE_TIME } from '@/lib/constants/query-config';

export function useProjects(params: {
  parentCommunityId?: string;
  projectStatus?: 'active' | 'closed' | 'archived';
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return trpc.project.list.useQuery(
    {
      parentCommunityId: params.parentCommunityId,
      projectStatus: params.projectStatus,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    },
    { staleTime: STALE_TIME.VERY_SHORT },
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
      utils.communities.getAll.invalidate();
      utils.users.getMe.invalidate();
      addToast(t('created'), 'success');
      router.push(`/meriter/projects/${project.id}`);
    },
    onError: (error) => {
      addToast(error.message || t('createError'), 'error');
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
      addToast(error.message || t('joinError'), 'error');
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
      addToast(error.message || t('leaveError'), 'error');
    },
  });
}

export function useProjectMembers(projectId: string | null, opts?: { page?: number; limit?: number; search?: string }) {
  return trpc.project.getMembers.useQuery(
    {
      projectId: projectId!,
      page: opts?.page,
      limit: opts?.limit,
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
      addToast(error.message || t('topUpError'), 'error');
    },
  });
}
