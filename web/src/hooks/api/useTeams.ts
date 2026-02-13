import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { useRouter } from 'next/navigation';

/**
 * Hook to create a team (local community)
 */
export function useCreateTeam() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);
  const router = useRouter();

  return trpc.communities.createTeam.useMutation({
    onSuccess: (community) => {
      // Invalidate relevant queries
      utils.communities.getAll.invalidate();
      utils.users.getMe.invalidate();
      utils.users.getUserCommunities.invalidate();
      utils.users.getMyLeadCommunities.invalidate();
      
      addToast('Команда успешно создана', 'success');
      
      // Navigate to the new community
      router.push(`/meriter/communities/${community.id}`);
    },
    onError: (error) => {
      const message = error.message || 'Не удалось создать команду';
      addToast(message, 'error');
    },
  });
}

/**
 * Hook to invite user to a team
 */
export function useInviteToTeam() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);

  return trpc.users.inviteToTeam.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.users.getInvitableCommunities.invalidate();
      utils.users.getUser.invalidate();
      utils.users.getUserRoles.invalidate();
      utils.users.getUserProfile.invalidate();
      
      addToast('Приглашение отправлено', 'success');
    },
    onError: (error) => {
      const message = error.message || 'Не удалось пригласить пользователя';
      addToast(message, 'error');
    },
  });
}

/**
 * Hook to assign user as lead of a community
 */
export function useAssignLead() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);

  return trpc.users.assignLead.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.users.getUser.invalidate();
      utils.users.getUserRoles.invalidate();
      utils.users.getUserProfile.invalidate();
      utils.communities.getById.invalidate();
      utils.communities.getAll.invalidate();
      
      addToast('Пользователь успешно назначен лидом', 'success');
    },
    onError: (error) => {
      const message = error.message || 'Не удалось назначить лидом';
      addToast(message, 'error');
    },
  });
}

/**
 * Hook to get communities where current user is lead and target user is not a member
 */
export function useInvitableCommunities(targetUserId: string) {
  return trpc.users.getInvitableCommunities.useQuery(
    { targetUserId },
    { enabled: !!targetUserId }
  );
}

/**
 * Hook to get communities where current user is lead
 */
export function useMyLeadCommunities() {
  return trpc.users.getMyLeadCommunities.useQuery();
}

/**
 * Hook to accept a team invitation
 */
export function useAcceptTeamInvitation() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);

  return trpc.users.acceptTeamInvitation.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.notifications.getAll.invalidate();
      utils.users.getMe.invalidate();
      utils.users.getUserCommunities.invalidate();
      utils.users.getUserRoles.invalidate();
      utils.users.getUserProfile.invalidate();

      addToast('Приглашение принято', 'success');
    },
    onError: (error) => {
      const message = error.message || 'Не удалось принять приглашение';
      addToast(message, 'error');
    },
  });
}

/**
 * Hook to reject a team invitation
 */
export function useRejectTeamInvitation() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((state) => state.addToast);

  return trpc.users.rejectTeamInvitation.useMutation({
    onSuccess: () => {
      // Invalidate relevant queries
      utils.notifications.getAll.invalidate();
      
      addToast('Приглашение отклонено', 'success');
    },
    onError: (error) => {
      const message = error.message || 'Не удалось отклонить приглашение';
      addToast(message, 'error');
    },
  });
}

